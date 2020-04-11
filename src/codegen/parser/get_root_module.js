const { dottedModuleName, joinModuleName, lastDottedPart, mapEnumValues, mapMessageType } = require('../helpers');

function validateProto(proto) {
  proto.forEach(protoFile => {
    if (!protoFile.package) {
      const errorMsg = 'your .proto file must contain a package name';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  });
}

function handleEnumType(parentModule, enumType) {
  const moduleName = dottedModuleName(joinModuleName(parentModule.moduleName, enumType.name))
  const module = {
    modules: {},
    moduleName,
    t: { enumValues: mapEnumValues(enumType.value) }
  }
  parentModule.modules[lastDottedPart(moduleName)] = module
}

function handleMessageType(parentModule, messageType) {
  /* Create module for this message type */
  const moduleName = dottedModuleName(joinModuleName(parentModule.moduleName, messageType.name))
  const module = {
    modules: {},
    moduleName
  }
  parentModule.modules[lastDottedPart(moduleName)] = module
  const message = module.t = {
    fields: messageType.field.map(field => ({
      name: field.name,
      type: field.type,
      typeName: field.typeName,
      label: field.label,
      oneofIndex: field.hasOwnProperty('oneofIndex') ? field.oneofIndex : -1,
    })),
    oneofs: messageType.oneofDecl.map(oneof => ({
      name: oneof.name,
      fields: []
    })),
  }
  messageType.field.forEach((field, iField) => {
    if (field.hasOwnProperty('oneofIndex')) {
      const oneofIndex = field.oneofIndex
      message.oneofs[oneofIndex].fields.push(
        message.fields[iField]
      )
    }
  })
  messageType.nestedType.forEach(nestedType => {
    handleMessageType(module, nestedType)
  })
  messageType.enumType.forEach(enumType => {
    handleEnumType(module, enumType)
  })
}

function getRootModule(proto) {
  validateProto(proto);
  const rootModule = { moduleName: '*root*', modules: {} }
  const packagePrefixesToIgnore = ['google.'];
  protoFile = proto.filter(protoFile =>
    !packagePrefixesToIgnore.some(prefix =>
      protoFile.package.substr(0, prefix.length) == prefix
    )
  );
  /* For each .proto file... */
  protoFile.forEach(protoFile => {
    /* Create module for this proto file */
    const protoFileModuleName = dottedModuleName(protoFile.package)
    const protoFileModule = {
      modules: {},
      moduleName: protoFileModuleName,
      packageName: protoFile.package,
      fileName: protoFile.name,
    }
    rootModule.modules[lastDottedPart(protoFileModuleName)] = protoFileModule
    /* For each message type defined... */
    protoFile.messageType.forEach(messageType => {
      handleMessageType(protoFileModule, messageType)
    })
    protoFile.enumType.forEach(enumType => {
      handleEnumType(protoFileModule, enumType)
    })
    protoFile.service.forEach(service => {
      const moduleName = joinModuleName(protoFileModuleName, service.name)
      const serviceModule = {
        modules: [],
        moduleName,
        /* service modules need this to find their loaded protobuf specs */
        serviceName: service.name,
        rpcs: service.method.map(method => {
          const name = method.name
          const inputType = mapMessageType(method.inputType)
          const outputType = mapMessageType(method.outputType)
          const clientStreaming = method.clientStreaming
          const serverStreaming = method.serverStreaming
          return {
            name,
            inputType,
            outputType,
            clientStreaming,
            serverStreaming,
          }
        })
      }
      protoFileModule.modules[lastDottedPart(moduleName)] = serviceModule
    })
  })
  return rootModule;
}

exports.getRootModule = getRootModule;