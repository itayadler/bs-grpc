const protobufs = require('../../gen/protobufs')

const dottedModuleName = moduleName =>
  moduleName.split('.').map((s, i) =>
    s[0].toUpperCase() + s.substr(1)
  ).join('.')
const lastDottedPart = moduleName => {
  const a = moduleName.split('.')
  return a[a.length - 1]
}
const mapMessageType = messageType => messageType[1].toUpperCase() + messageType.substr(2) + '.t';
const mapTypeNameToModuleName = enumTypeName => enumTypeName[1].toUpperCase() + enumTypeName.substr(2)
const mapEnumType = enumTypeName => mapTypeNameToModuleName(enumTypeName) + '.t';
const joinModuleName = (...args) => args.map(s => s[0] == '.' ? s.substr(1) : s).join('.')
const resolveRelative = (moduleName, scopeName) => {
  const scopeParts = scopeName.split('.')
  const moduleParts = moduleName.split('.')
  const max = Math.max(scopeParts.length, moduleParts.length)
  for (let i = 0; i < max; i++)
    if (scopeParts[i] !== moduleParts[i])
      return moduleParts.slice(i).join('.')
  throw new Error("how do i name myself?")
}
const lower1 = s => s[0].toLowerCase() + s.substr(1)
const upper1 = s => s[0].toUpperCase() + s.substr(1)

const mapJustType = (fieldProto, scopeName) => {
  switch (fieldProto.type) {
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_GROUP:
    default:
      return 'unknown_type /*' + type + '*/';
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_ENUM:
      return upper1(resolveRelative(mapEnumType(fieldProto.typeName), scopeName))
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_MESSAGE:
      return upper1(resolveRelative(mapMessageType(fieldProto.typeName), scopeName))
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_BOOL:
      return 'bool'
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_BYTES:
      return 'UNHANDLED_TYPE_BYTES'
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_STRING:
      return 'string'
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_DOUBLE:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_FLOAT:
      return 'float'
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_FIXED32:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_INT32:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_SFIXED32:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_SINT32:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_UINT32:
      return 'int'
    /* TODO in the future we'll want more flexibility in how we represent 64-bit values */
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_FIXED64:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_INT64:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_SFIXED64:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_SINT64:
    case protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_UINT64:
      return 'string'
  }
}
const mapType = (field, scopeName) => {
  const justType = mapJustType(field, scopeName)
  switch (field.label) {
    default:
    case protobufs.google.protobuf.FieldDescriptorProto.Label.LABEL_OPTIONAL:
      return ['[@bs.optional]', justType]
    case protobufs.google.protobuf.FieldDescriptorProto.Label.LABEL_REPEATED:
      return ['[@bs.optional]', `array(${justType})`]
    case protobufs.google.protobuf.FieldDescriptorProto.Label.LABEL_REQUIRED:
      return ['/* required */', justType]
  }
}
/** similar to mapType, but emits 'int' for ENUMs */
const mapTypeForMessageField = (field, scopeName) => {
  if (field.type == protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_ENUM)
    field = { ...field, type: protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_INT32 }
  return mapType(field, scopeName)
}
function isEnumField(field) { return field.type == protobufs.google.protobuf.FieldDescriptorProto.Type.TYPE_ENUM }
function someEnumFields(fields) { return fields.some(isEnumField) }
/* make function names for converting between protobufjs' representation of values of enums and bs-grpc's representation */
function makeFunNameConvEnumOfInt(enumModuleRef) { return `${upper1(enumModuleRef)}.${lower1(enumModuleRef)}OfInt` }
function makeFunNameConvIntOfEnum(enumModuleRef) { return `${upper1(enumModuleRef)}.intOf${upper1(enumModuleRef)}` }

function enumName(name) {
  return name.split('_').map(part => part[0].toUpperCase() + part.substr(1).toLowerCase()).join('')
}

function mapEnumValues(values) {
  return values.map(enumValue => ({
    name: enumName(enumValue.name),
    number: enumValue.number
  }))
}

const quote = s => {
  if ('string' !== typeof s)
    throw new Error("expecting string")
  return JSON.stringify(s)
}

const moduleDirName = moduleName => moduleName.split('.').slice(0, -1).join('.');
const makeConstructorName = s => s;

exports.enumName = enumName;
exports.isEnumField = isEnumField;
exports.makeFunNameConvEnumOfInt = makeFunNameConvEnumOfInt;
exports.makeFunNameConvIntOfEnum = makeFunNameConvIntOfEnum;
exports.mapEnumValues = mapEnumValues;
exports.someEnumFields = someEnumFields;
exports.dottedModuleName = dottedModuleName;
exports.joinModuleName = joinModuleName;
exports.lastDottedPart = lastDottedPart;
exports.lower1 = lower1;
exports.makeConstructorName = makeConstructorName;
exports.mapEnumValues = mapEnumValues;
exports.mapJustType = mapJustType;
exports.mapMessageType = mapMessageType;
exports.mapType = mapType;
exports.mapTypeForMessageField = mapTypeForMessageField;
exports.mapTypeNameToModuleName = mapTypeNameToModuleName;
exports.moduleDirName = moduleDirName;
exports.resolveRelative = resolveRelative;
exports.upper1 = upper1;
exports.quote = quote;