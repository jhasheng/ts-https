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
  0: 'HelloRequest',
  1: 'ClientHello',
  2: 'ServerHello',
  3: 'HelloVerifyRequest',
  11: 'Certificate',
  12: 'ServerKeyExchange',
  13: 'CertificateRequest',
  14: 'ServerHelloDone',
  15: 'CertificateVerify',
  16: 'ClientKeyExchange',
  20: 'Finished',
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