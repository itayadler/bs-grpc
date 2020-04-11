function emitServerKeyAndCert() {
  return `
  /* This type is part of the type of grpc.ServerCredentials.createSsl() */
  module ServerKeyAndCert {
    [@bs.deriving abstract]
    type t = {
      [@bs.as "private_key"] privateKey: Node.Buffer.t,
      [@bs.as "cert_chain"] certChain: Node.Buffer.t,
    };
  };
`
}
exports.emitServerKeyAndCert = emitServerKeyAndCert