// enum {
//   change_cipher_spec(20), alert(21), handshake(22),
//   application_data(23), (255)
// } ContentType;
export const ContentType = {
  20: 'change_cipher_spec',
  21: 'alert',
  22: 'handshake',
  23: 'application_data'
}

export const ProtocolVersion = {
  0x0300: 'SSL_v3.0',
  0x0301: 'TLS_v1.0',
  0x0302: 'TLS_v1.1',
  0x0303: 'TLS_v1.2'
}

export const HandshakeType = {
  0: 'hello_request_RESERVED',
  1: 'client_hello',
  2: 'server_hello',
  3: 'hello_verify_request_RESERVED',
  4: 'new_session_ticket',
  5: 'end_of_early_data',
  6: 'hello_retry_request_RESERVED',
  7: 'Unassigned',
  8: 'encrypted_extensions',
  9: 'Unassigned',
  10: 'Unassigned',
  11: 'certificate',
  12: 'server_key_exchange_RESERVED',
  13: 'certificate_request',
  14: 'server_hello_done_RESERVED',
  15: 'certificate_verify',
  16: 'client_key_exchange_RESERVED',
  20: 'finished',
}

// struct {
//   ContentType type;
//   ProtocolVersion version;
//   uint16 length;
//   opaque fragment[TLSPlaintext.length];
// } TLSPlaintext;
// export type TLSPlaintext = {
//   type: ContentType,
//   version: ProtocolVersion,
//   length: number,
//   fragment: any
// }