const { upper1, lower1, lastDottedPart, mapTypeForMessageField, someEnumFields,
  resolveRelative, mapTypeNameToModuleName, makeFunNameConvIntOfEnum, makeFunNameConvEnumOfInt,
  mapJustType, makeConstructorName, quote } = require('./helpers');

function emitModule(module, moduleDeps, rootModulePackageName) {
  let code = ''
  /* diagnostic output */
  if (module.fileName) code += `/* fileName = "${module.fileName}" */\n`
  code += `/* moduleName = "${module.moduleName}" */\n`
  code += emitLoadProtoFunction(module)
  code += emitSubModules(module, moduleDeps, rootModulePackageName)
  code += emitModuleTypes(module)
  code += emitModuleRpcs(module, rootModulePackageName)
  return code;
}

function emitLoadProtoFunction(module) {
  let code = ''
  /* Invoke grpc-node's load() method to generate and load javascript
   * bindings to our .proto
   */
  if ('fileName' in module) {
    /* TODO will path be correct at runtime?
     * TODO escape path
     */
    code += `
        type grpcProtoHandle;
        [@bs.get] external getProtoHandle : grpcLoadResult => grpcProtoHandle = "${module.packageName}";
        let myProtoHandle = grpcLoadProto(${JSON.stringify(module.fileName)}) |> getProtoHandle;
      `
  }
  return code
}

function emitSubModules(module, moduleDeps, rootModulePackageName) {
  let code = ''
  /* sort sub-modules by order of dependency */
  const subModuleOrder = Object.keys(module.modules).map(shortModuleName => {
    const moduleName = module.modules[shortModuleName].moduleName
    return {
      shortModuleName,
      position: moduleDeps.indexOf(moduleName)
    }
  })
  subModuleOrder.sort((a, b) => a.position - b.position)
  /* emit code for each sub-module in order */
  subModuleOrder.forEach(subModulePosition => {
    const shortModuleName = subModulePosition.shortModuleName
    code += `module ${shortModuleName} {\n`
    code += emitModule(module.modules[shortModuleName], moduleDeps, rootModulePackageName)
    code += `};\n`
  })
  return code
}

function emitModuleTypes(module) {
  let code = '';
  /* emit code for any type contained in our module */
  if ('t' in module) {
    if ('fields' in module.t) {
      const hasEnumField = someEnumFields(module.t.fields)
      code += `/* Message module */
          [@bs.deriving abstract]
          type t =
        `
      if (module.t.fields.length) {
        code += "{\n"
        module.t.fields.forEach(field => {
          const [fieldQualifier, fieldType] = mapTypeForMessageField(field, module.moduleName)
          code += `${fieldQualifier} ${field.name} : ${fieldType},\n`
        })
        module.t.oneofs.forEach(oneof => {
          code += `/* oneof */ ${oneof.name}: string,\n`;
        })
        code += "}";
      } else {
        code += "{ /* this type needs at least one field */ [@bs.optional] dontSetMe : string }"
      }
      code += ";\n";
      /* to support enums, we need to provide our own accessors of enum
       * fields that convert between protobufjs' representation of enums
       * (javascript Number values) and our own variant type */
      if (hasEnumField) {
        /* first shadow the deriving abstract constructor function */
        code += `/** message constructor (shadows the deriving abstract constructor) */
            let t = (
          `
        module.t.fields.forEach(field => {
          if (field.oneofIndex < 0) {
            code += `~${field.name}=?,\n`
          }
        })
        module.t.oneofs.forEach(oneof => {
          code += `~${oneof.name},\n`
        })
        code += '()) => t(\n'
        module.t.fields.forEach(field => {
          if (isEnumField(field)) {
            const enumModuleRef = resolveRelative(mapTypeNameToModuleName(field.typeName), module.moduleName)
            const conv = makeFunNameConvIntOfEnum(enumModuleRef)
            code += `~${lower1(field.name)} =? (`
            code += `@@ ${conv}) @@ ${lower1(field.name)},\n`
          } else {
            code += `~${lower1(field.name)}?,\n`
          }
        })
        code += `());\n`
        module.t.fields.forEach(field => {
          if (isEnumField(field)) {
            const enumModuleRef = resolveRelative(mapTypeNameToModuleName(field.typeName), module.moduleName)
            const conv = makeFunNameConvEnumOfInt(enumModuleRef)
            code += `/* enum converting getter */
                let ${field.name}Get =
              `
            code += `@@ ${conv} << ${field.name}Get;
              `
          }
        })
      }
      /* to support protobufs oneof fields, we create a variant type for
       * each oneof.
       */
      module.t.oneofs.forEach(oneof => {
        /* variant type for oneof */
        code += `type ${oneof.name} =\n`
        oneof.fields.forEach(field => {
          const justType = mapJustType(field, module.moduleName)
          const constructorName = makeConstructorName(justType)
          code += `| ${upper1(field.name)}(${constructorName})\n`
        })
        code += ';\n'
      })
      /* Emit a new constructor function overriding the one emitted by
       * [@bs.deriving abstract] which accepts our oneof variants
       *
       * TODO hide the abstract constructor function "t"
       */
      code += `/* safe message constructor (may replace t()) */\nlet make = (\n`
      module.t.fields.forEach(field => {
        if (field.oneofIndex < 0) {
          code += `~${field.name}=?,\n`
        }
      })
      module.t.oneofs.forEach(oneof => {
        code += `~${oneof.name},\n`
      })
      code += '()) => t(\n'
      module.t.fields.forEach(field => {
        /* Note the question mark here indicates that we will be passing
         * an option-boxed values explicitly
         */
        code += `~${field.name} =?`
        if (field.oneofIndex >= 0) {
          const oneof = module.t.oneofs[field.oneofIndex]
          code += `(${oneof.name} |> /* fun1 */ fun\n`
          oneof.fields.forEach(field2 => {
            const varName = field === field2 ? 'x' : '_';
            const valCode = field === field2 ? `Some(x)` : 'None';
            code += `| ${upper1(field2.name)}(${varName}) => ${valCode}\n`
          })
          code += `),`
        } else {
          code += `${field.name},`
        }
        code += `\n`
      })
      module.t.oneofs.forEach(oneof => {
        code += `~${oneof.name} = (${oneof.name} |> (/* fun2 */ fun\n`
        oneof.fields.forEach(field1 => {
          code += `| ${upper1(field1.name)}(_) => ${JSON.stringify(field1.name)}\n`
        })
        code += `))\n,\n`
      })
      code += `());\n`
      /* We'll also override the oneofs' accessor functions (which would
       * only give us a string indicating which of a oneof's fields
       * contains a value) to provide a value of the variant type we
       * created to represent each oneof field
       */
      module.t.oneofs.forEach(oneof => {
        code += `/* Oneof variant getter */
          let ${oneof.name} = x => x |> ${oneof.name}Get |> (/* fun3 */ fun\n`
        oneof.fields.forEach(field => {
          code += `| ${JSON.stringify(field.name)} => ${upper1(field.name)}(
              x |> ${field.name}Get |> ( /* fun4 */ fun
              | Some (x) => x
              | None => raise(BsGrpcDecoderError("expected Some ${field.name}"))
              )
            )\n`
        })
        code += `
          | _ => raise(ImpossibleError("decoding oneof field switch invalid"))
          );
          `
      })
      code += `
           type codec;

          [@bs.send] external encode : (codec, t, justNull, justNull) => byteBuffer = "encode";
          [@bs.send] external decode : (codec, Node.buffer, justNull, justNull) => t = "decode";

          [@bs.get] external codec : grpcProtoHandle => codec = ${quote(lastDottedPart(module.moduleName))};

          let codec = myProtoHandle |. codec;

          let encode = x =>
            encode(codec, x, Js.Nullable.undefined, Js.Nullable.undefined)
            |. bufferOfByteBuffer;
          let decode = x =>
            decode(codec, x, Js.Nullable.undefined, Js.Nullable.undefined);
        `
    } else if ('enumValues' in module.t) {
      const shortName = lastDottedPart(module.moduleName)
      code += `
          /* enum type */
          type t =
        `
      module.t.enumValues.forEach(enumValue => {
        code += `| ${enumValue.name}\n`
      })
      code += `;
          /** convert a grpc enum ordinal to its ${shortName}.t counterpart; internal */
          let ${lower1(shortName)}OfInt = fun
        `
      module.t.enumValues.forEach(enumValue => {
        code += `| ${enumValue.number} => ${enumValue.name}\n`
      })
      code += `
          | x => raise(BsGrpcDecoderError({j|bs-grpc encountered invalid ${shortName} enum value $x|j}));
          /** convert a ${shortName}.t to its the grpc enum ordinal counterpart; internal */
          let intOf${upper1(shortName)} = fun
        `
      module.t.enumValues.forEach(enumValue => {
        code += `| ${enumValue.name} => ${enumValue.number}\n`
      })
    }
  }
  return code;
}

function emitModuleRpcs(module, rootModulePackageName) {
  let code = "";
  /* emit code for any RPCs */
  if ('rpcs' in module) {
    module.rpcs.forEach(rpc => {
      const inputType = resolveRelative(rpc.inputType, module.moduleName)
      const outputType = resolveRelative(rpc.outputType, module.moduleName)
      if (rpc.serverStreaming) {
        code += `
          module ${upper1(rpc.name)}Rpc {
            /* Rpc module */
            /** the input/request type of the ${rpc.name} RPC */
            type inputType = ${inputType};
            /** the output/reply type of the ${rpc.name} RPC */
            type outputType = ${outputType};
            /** the type of the object from which rpc implementations may
             * obtain request payload and metadata. an object of this type is
             * passed to your rpc implementation. */
            type call = {
              .
              "request": inputType,
              "write": [@bs.meth] (outputType => unit),
              "emit": [@bs.meth] ((string, Js.Promise.error) => unit),
              "end__": [@bs.meth] [@bs.as "end"] (unit => unit),
            };
            /** server implementation function type. request payload and
                   * metadata can be obtained via the \`call\` argument furnished to
                   * your rpc implementation. the second argument allows you to
                   * furnish a reply, although three of its four arguments should be
                   * unused. */
            type t = call => Rx.Observable.t(outputType);
          };
        `
      } else {
        code += `
          module ${upper1(rpc.name)}Rpc {
            /* Rpc module */
            /** the input/request type of the ${rpc.name} RPC */
            type inputType = ${inputType};
            /** the output/reply type of the ${rpc.name} RPC */
            type outputType = ${outputType};
            /** the type of the object from which rpc implementations may
             * obtain request payload and metadata. an object of this type is
             * passed to your rpc implementation. */
            [@bs.deriving abstract]
            type call = { request: inputType };
            /** server implementation function type. request payload and
             * metadata can be obtained via the \`call\` argument furnished to
             * your rpc implementation. the second argument allows you to
             * furnish a reply, although three of its four arguments should be
             * unused. */
            type t = (
              call,
              (.
                justNull,
                outputType,
                justNull,
                justNull
              ) => unit
            ) => unit;
            let getMeta : call => Js.Dict.t(Js.Json.t) = [%bs.raw {|
              call => call.metadata.getMap()
            |}];
          };
        `

      }
    })
    code += `
        /** objects of this type are actually grpc service client constructor
         * functions, however, they have a property, "service," whose value is
         * used to add services to a server object, too. */
        type grpcServiceObject;
        [@bs.get]
        external myServiceClient
          : grpcProtoHandle => grpcServiceObject
          = ${JSON.stringify(module.serviceName)};
        let myServiceClient = myProtoHandle |> myServiceClient;
        module Client = {
          /** a client object for the ${module.serviceName} service */
          type t;
          /** the type of the error argument in the callback you supply when
           you invoke an rpc */
          type maybeError = Js.Nullable.t(grpcClientRpcInvokeError);
          /* client construction */
          let makeClient : (grpcServiceObject, string, channelCredentials) => t = [%bs.raw "(x,y,z) => new x(y,z)"];
          /** construct a client for the ${rootModulePackageName}.${module.moduleName} grpc service. arguments:
           serverAddress: string of address and port of server (e.g. "127.0.0.1:12345")
           chanCreds: your channel credentials */
          let makeClient = (serverAddress, chanCreds) => makeClient(myServiceClient, serverAddress, chanCreds);
      `
    module.rpcs.forEach(rpc => {
      const rpcModuleRef = upper1(rpc.name) + 'Rpc'
      const myModuleName = rpcModuleRef
      const inputType = rpcModuleRef + '.inputType'
      const outputType = rpcModuleRef + '.outputType'
      if (rpc.clientStreaming) {
        code += `
        module ${myModuleName} = {
          [@bs.send]
          external invokeStream:
            (t, ${inputType}) =>
            NodeJs.Stream.Readable.t(${outputType}) = ${quote(lower1(rpc.name))};
          /** invoke an rpc using streams */
          let invoke = (client, input) => {
            Rx.Observable.create(
              ~subscribe=
                \`NoTeardown(
                  subscriber => {
                    let call = invokeStream(client, input);
                    NodeJs.Stream.onData(call, data =>
                      subscriber |> Rx.Subscriber.next(data)
                    );
                    NodeJs.Stream.onError(call, error =>
                      subscriber |> Rx.Subscriber.error(error)
                    );
                    NodeJs.Stream.onEnd(call, () =>
                      subscriber |> Rx.Subscriber.complete
                    );
                    ();
                  }
                ),
              (),
            );
          };
        }
        `
      } else {
        code += `
          module ${myModuleName} = {
            /** the type of the callback you must supply when you invoke an rpc */
            type callback = (maybeError, ${outputType}) => unit;
            /** invoke an rpc using callback style. arguments:
             t: the client over which to send the rpc request
             ${inputType}: the request payload message
             callback: a function which will be invoked when a reply from the
               server is available, or when an error occurs */
            [@bs.send]
            external invoke : (t, ${inputType}, callback) => unit = ${quote(lower1(rpc.name))};
            /** invoke an rpc using promises */
            let invokePromise = (client, input) => Js.Promise.make((~resolve, ~reject) => {
              invoke(client, input, (err, res) => {
                switch (err |. Js.Nullable.toOption) {
                | Some(err) => reject(. GrpcClientRpcInvokeError(err))
                | None => resolve(. res)
                }
              });
            });
          }
        `
      }
    })
    code += `
        };
        type grpcServiceServer;
        [@bs.get]
        external getServerServiceHandle : grpcServiceObject => grpcServiceServer =
          "service";
        let myServerServiceHandle = myServiceClient |> getServerServiceHandle;
      `
    /* the deriving abstract record type is chosen because it can be fed
     * directly to grpc-node's grpc.Server#addService method
     */
    code += '/* Service implementation type */\n[@bs.deriving abstract]\ntype t = {\n'
    module.rpcs.forEach(rpc => {
      code += `${lower1(rpc.name)}: ${upper1(rpc.name)}Rpc.t,\n`;
    })
    code += `};`
    code += `
      [@bs.send] external addService : (server, grpcServiceServer, t) => unit = "addService";
      let addService = (server, serviceFunc: t) =>
        addService(server, myServerServiceHandle, 
          t(

    `
    module.rpcs.forEach(rpc => {
      if (rpc.serverStreaming) {
        code += `
        ~${lower1(rpc.name)}=
        (call) => {
          let outerCall = serviceFunc->searchGet;
          let response = outerCall(call);
          response
          |> Rx.Observable.forEach(data => call##write(data))
          |> Js.Promise.then_(() => call##end__() |> Js.Promise.resolve)
          |> Js.Promise.catch(err => {
               call##emit("error", err) |> Js.Promise.resolve;
             })
          |> ignore;
          response;
        }
        `

      } else {
        code += `
        ~${lower1(rpc.name)}=
          (call, callback) => {
            let outerCall = serviceFunc->${lower1(rpc.name)}Get;
            outerCall(call, callback);
            ();
          }
        `
      }
    })
    code += `
          )
      );
    `
    code += `
      /** creates an implementation of the ${module.serviceName}. The RPC
       * implementations you pass to this function will only be invoked after
       * any sanitization/normalization code has processed the
       * message without error. */
      let make = (\n`
    module.rpcs.forEach(rpc => {
      code += `~${lower1(rpc.name)},\n`;
    })
    code += `\n) => t(\n`;
    module.rpcs.forEach(rpc => {
      if (rpc.serverStreaming) {
        code += `
                ~${lower1(rpc.name)}=
          (call) => {
            ${lower1(rpc.name)}(call, call##request);
          },
        `

      } else {
        code += `
                ~${lower1(rpc.name)}=
          (call, callback) => {
            let request = call |. ${upper1(resolveRelative(rpc.name, module.moduleName))}Rpc.requestGet;
            ${lower1(rpc.name)}(call, request, callback);
          },
        `
      }
    })
    code += `)\n`;
  }
  return code
}

exports.emitModule = emitModule