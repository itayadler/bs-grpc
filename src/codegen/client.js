function emitClient() {
  return `module Client = {
    module Metadata = {
      type t;
      [@bs.module "@grpc/grpc-js"] [@bs.new] external make : unit => t = "Metadata";
      [@bs.send] external set : (t, string, string) => unit = "set";
      let set = (t, key, value) => {
        set(t, key, value);
        t
      };
      module Generator = {
        /** the type of the function you must call to furnish an RPC invocation with
         either its metadata or a metadata generation error. see \`makeGenerator\`
        for details */
        type complete = (Js.Nullable.t(exn), t) => unit;
        /** consumers of bs-grpc who want to use metadata must implement a function
         of this type. see \`makeGenerator\` for more details */
        type generatorImplementation = (unit, complete) => unit;
        /** to populate a grpc request with metadata, grpc-node requires you to
         supply a metadata generator function, which receives as its first argument
         the call object reflecting the request payload (not available in this
         binding) while the second argument is a function your metadata generator
         function must invoke with either an exception or the resulting metadata */
        [@bs.module "@grpc/grpc-js"]
        [@bs.scope "credentials"]
        external make : generatorImplementation => callCredentials =
          "createFromMetadataGenerator";
      };
    };

    module Credentials = {
      [@bs.module "@grpc/grpc-js"]
      [@bs.scope "credentials"]
      external createInsecure : unit => channelCredentials = "createInsecure";

      [@bs.module "@grpc/grpc-js"]
      [@bs.scope "credentials"]
      external createSsl : (Node.buffer, Node.buffer, Node.buffer) => channelCredentials = "createSsl";

      [@bs.module "@grpc/grpc-js"]
      [@bs.scope "credentials"]
      external combine
        : (channelCredentials, callCredentials)
        => channelCredentials
        = "combineChannelCredentials";

      [@bs.module "@grpc/grpc-js"]
      [@bs.scope "credentials"]
      external combine3
        : (channelCredentials, callCredentials, callCredentials)
        => channelCredentials
        = "combineChannelCredentials";
    }
  };

  /* use this to load a nodejs Buffer object containing a base64-encoded
   * PEM format key/certificate
   */
  [@bs.val] [@bs.module "fs"]
  external loadCert : string => Node.buffer = "readFileSync";
  `;
}

exports.emitClient = emitClient 