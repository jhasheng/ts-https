import { Url, parse } from "url";

/**
 * Function that intercepts and rewrites HTTP responses.
 */
export type Interceptor = (m: InterceptedHTTPMessage) => void | Promise<void>;

/**
 * The core HTTP response.
 */
export interface HTTPResponse {
  statusCode: number,
  headers: { [name: string]: string };
  body: Buffer;
}

/**
 * Metadata associated with an HTTP response.
 */
export interface HTTPResponseMetadata {
  // The numerical status code.
  status_code: number;
  // The set of headers from the response, as key-value pairs.
  // Since header fields may be repeated, this array may contain multiple entries for the same key.
  headers: [string, string][];
}

/**
 * Metadata associated with a request/response pair.
 */
interface HTTPMessageMetadata {
  request: HTTPRequestMetadata;
  response: HTTPResponseMetadata;
}

/**
 * Metadata associated with an HTTP request.
 */
export interface HTTPRequestMetadata {
  // GET, DELETE, POST,  etc.
  method: string;
  // Target URL for the request.
  url: string;
  // The set of headers from the request, as key-value pairs.
  // Since header fields may be repeated, this array may contain multiple entries for the same key.
  headers: [string, string][];
}

/**
 * Represents an intercepted HTTP request/response pair.
 */
export class InterceptedHTTPMessage {
  /**
   * Unpack from a Buffer received from MITMProxy.
   * @param b
   */
  public static FromBuffer(b: Buffer): InterceptedHTTPMessage {
    const metadataSize = b.readInt32LE(0);
    const requestSize = b.readInt32LE(4);
    const responseSize = b.readInt32LE(8);
    const metadata: HTTPMessageMetadata = JSON.parse(b.toString("utf8", 12, 12 + metadataSize));
    return new InterceptedHTTPMessage(
      new InterceptedHTTPRequest(metadata.request),
      new InterceptedHTTPResponse(metadata.response),
      b.slice(12 + metadataSize, 12 + metadataSize + requestSize),
      b.slice(12 + metadataSize + requestSize, 12 + metadataSize + requestSize + responseSize)
    );
  }

  public readonly request: InterceptedHTTPRequest;
  public readonly response: InterceptedHTTPResponse;
  // The body of the HTTP request.
  public readonly requestBody: Buffer;
  // The body of the HTTP response. Read-only; change the response body via setResponseBody.
  public get responseBody(): Buffer {
    return this._responseBody;
  }
  private _responseBody: Buffer;
  private constructor(request: InterceptedHTTPRequest, response: InterceptedHTTPResponse, requestBody: Buffer, responseBody: Buffer) {
    this.request = request;
    this.response = response;
    this.requestBody = requestBody;
    this._responseBody = responseBody;
  }

  /**
   * Changes the body of the HTTP response. Appropriately updates content-length.
   * @param b The new body contents.
   */
  public setResponseBody(b: Buffer) {
    this._responseBody = b;
    // Update content-length.
    this.response.setHeader('content-length', `${b.length}`);
    // TODO: Content-encoding?
  }

  /**
   * Pack into a buffer for transmission to MITMProxy.
   */
  public toBuffer(): Buffer {
    const metadata = Buffer.from(JSON.stringify(this.response), 'utf8');
    const metadataLength = metadata.length;
    const responseLength = this._responseBody.length
    const rv = Buffer.alloc(8 + metadataLength + responseLength);
    rv.writeInt32LE(metadataLength, 0);
    rv.writeInt32LE(responseLength, 4);
    metadata.copy(rv, 8);
    this._responseBody.copy(rv, 8 + metadataLength);
    return rv;
  }
}

/**
 * Abstract class that represents HTTP headers.
 */
export abstract class AbstractHTTPHeaders {
  private _headers: [string, string][];
  // The raw headers, as a sequence of key/value pairs.
  // Since header fields may be repeated, this array may contain multiple entries for the same key.
  public get headers(): [string, string][] {
    return this._headers;
  }
  constructor(headers: [string, string][]) {
    this._headers = headers;
  }

  private _indexOfHeader(name: string): number {
    const headers = this.headers;
    const len = headers.length;
    for (let i = 0; i < len; i++) {
      if (headers[i][0].toLowerCase() === name) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get the value of the given header field.
   * If there are multiple fields with that name, this only returns the first field's value!
   * @param name Name of the header field
   */
  public getHeader(name: string): string {
    const index = this._indexOfHeader(name.toLowerCase());
    if (index !== -1) {
      return this.headers[index][1];
    }
    return '';
  }

  /**
   * Set the value of the given header field. Assumes that there is only one field with the given name.
   * If the field does not exist, it adds a new field with the name and value.
   * @param name Name of the field.
   * @param value New value.
   */
  public setHeader(name: string, value: string): void {
    const index = this._indexOfHeader(name.toLowerCase());
    if (index !== -1) {
      this.headers[index][1] = value;
    } else {
      this.headers.push([name, value]);
    }
  }

  /**
   * Removes the header field with the given name. Assumes that there is only one field with the given name.
   * Does nothing if field does not exist.
   * @param name Name of the field.
   */
  public removeHeader(name: string): void {
    const index = this._indexOfHeader(name.toLowerCase());
    if (index !== -1) {
      this.headers.splice(index, 1);
    }
  }

  /**
   * Removes all header fields.
   */
  public clearHeaders(): void {
    this._headers = [];
  }
}

/**
 * Represents a MITM-ed HTTP response from a server.
 */
export class InterceptedHTTPResponse extends AbstractHTTPHeaders {
  // The status code of the HTTP response.
  public statusCode: number;

  constructor(metadata: HTTPResponseMetadata) {
    super(metadata.headers);
    this.statusCode = metadata.status_code;
    // We don't support chunked transfers. The proxy already de-chunks it for us.
    this.removeHeader('transfer-encoding');
    // MITMProxy decodes the data for us.
    this.removeHeader('content-encoding');
    // CSP is bad!
    this.removeHeader('content-security-policy');
    this.removeHeader('x-webkit-csp');
    this.removeHeader('x-content-security-policy');
  }

  public toJSON(): HTTPResponseMetadata {
    return {
      status_code: this.statusCode,
      headers: this.headers
    };
  }
}

/**
 * Represents an intercepted HTTP request from a client.
 */
export class InterceptedHTTPRequest extends AbstractHTTPHeaders {
  // HTTP method (GET/DELETE/etc)
  public method: string;
  // The URL as a string.
  public rawUrl: string;
  // The URL as a URL object.
  public url: Url;

  constructor(metadata: HTTPRequestMetadata) {
    super(metadata.headers);
    this.method = metadata.method.toLowerCase();
    this.rawUrl = metadata.url;
    this.url = parse(this.rawUrl);
  }
}

/**
 * An interceptor that does nothing.
 */
export function nopInterceptor(m: InterceptedHTTPMessage): void { }