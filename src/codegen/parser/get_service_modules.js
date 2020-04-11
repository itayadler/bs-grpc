function getServiceModules(rootModule) {
  const foundServices = {}
  recurse(rootModule)
  function recurse(module) {
    if ('rpcs' in module)
      foundServices[module.moduleName] = {
        fileName: module.fileName,
        module,
      }
    for (let moduleName in module.modules)
      recurse(module.modules[moduleName])
  }
  const serviceModules = []
  for (let k in foundServices)
    serviceModules.push(foundServices[k].module)
  return serviceModules
}

exports.getServiceModules = getServiceModules;