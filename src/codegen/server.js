const { getServiceModules } = require('./parser/get_service_modules')
const { lower1, lastDottedPart } = require('./helpers')

function emitServerModule(module) {
  if (module.moduleName !== "*root*") {
    return ''
  }
  const serviceModules = getServiceModules(module)
  const servicesArgumentsList = serviceModules.map(serviceModule =>
    `~${lower1(lastDottedPart(serviceModule.moduleName))}=?,\n`
  ).join('')

  const bindServicesCode = serviceModules.map(serviceModule =>
    `${lower1(lastDottedPart(serviceModule.moduleName))}
    |. optCall(
      ~f=${serviceModule.moduleName}.addService(server)
    );
    `
  ).join('')

  return `
  module Server = {
    module Credentials = {
      /* These are the public static constructor functions for
       * grpc.ServerCredentials
       */
      module Ssl = {
        [@bs.module "@grpc/grpc-js"]
        [@bs.scope "ServerCredentials"]
        external make : (buffer, array(ServerKeyAndCert.t), bool) => serverCredentials =
          "createSsl";
        let make = (~rootCert: buffer, ~privateKey: buffer, ~certChain: buffer) =>
          make(
            rootCert,
            [|ServerKeyAndCert.t(~privateKey, ~certChain)|],
            true,
          );
      };
      module Insecure = {
        [@bs.module "@grpc/grpc-js"]
        [@bs.scope "ServerCredentials"]
        external make : unit => serverCredentials = "createInsecure";
      };
    };

    [@bs.module "@grpc/grpc-js"][@bs.new]
    external newServer : unit => server = "Server";

    [@bs.send]
    external serverBind: (server, string, serverCredentials, (string, int) => unit) => unit = "bindAsync";

    [@bs.send]
    external start : server => unit = "start";

    /** Convenience function to instantiate and configure a GRPC server */
    let make = (
      ~credentials,
      ${servicesArgumentsList}
      host,
    ) => {
      let server = newServer();
      serverBind(
        server,
        host,
        credentials,
        (_error, _port) => {
          ${bindServicesCode}
          start(server);
          ();
        },
      );
      server;
    };
  };
  `
}

exports.emitServerModule = emitServerModule;