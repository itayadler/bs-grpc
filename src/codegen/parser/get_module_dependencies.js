const toposort = require('toposort')
const { mapMessageType, moduleDirName } = require('../helpers');
const protobufs = require('../../../gen/protobufs')

function identifyModulesArray(rootModule) {
  const foundModules = []
  recurse(rootModule)
  function recurse(module) {
    foundModules.push(module)
    for (let moduleName in module.modules)
      recurse(module.modules[moduleName])
  }
  return foundModules;
}

function getModuleDependencies(rootModule) {
  /* In order to support custom options in our .proto file, we need to allocate
   * message fields in the protobuf messages that protoc uses to represent our
   * .proto files to our plugin. To do this we need to use the "extend"
   * capability of protobufs. To my intuition, we would apply this step when
   * generating our protoc protobuf compiler, so that the compiler knows about
   * our custom options and how to represent them to our plugin. I
   * haven't been able to figure out a way to do this. Instead, however, we can
   * apparently do the extend at protoc's runtime. Until a better solution is
   * discovered, I am blacklisting the following root packages (__no_emit being
   * my own invention) so that we do not emit code for them.
   *
   * TODO investigate using CodeGeneratorRequest.file_to_generate or
   * CodeGeneratorRequest.parameter
   */
  const dependencies = [];
  identifyModulesArray(rootModule).forEach(module => {
    if (module.moduleName !== '*root*') {
      dependencies.push(['*root*', module.moduleName])
      if (module.moduleName.indexOf('.') >= 0)
        dependencies.push([moduleDirName(module.moduleName), module.moduleName])
    }
    if ('t' in module) {
      /* we could emit our 't' without this, but this is necessary for
       * detecting cyclic dependencies */
      dependencies.push([module.moduleName, module.moduleName + '.t'])
      if ('fields' in module.t) {
        module.t.fields.forEach(field => {
          if (field.type == protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_ENUM
            || field.type == protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_MESSAGE) {
            dependencies.push([mapMessageType(field.typeName), module.moduleName])
          }
        })
      }
    }
    if ('rpcs' in module) {
      module.rpcs.forEach(rpc => {
        dependencies.push([rpc.inputType, module.moduleName])
        dependencies.push([rpc.outputType, module.moduleName])
      })
    }
  }, [])
  return toposort(dependencies).slice(1);
}

exports.getModuleDependencies = getModuleDependencies;