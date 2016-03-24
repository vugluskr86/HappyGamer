// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');

    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }
  
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
      return func;
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
if (HEAPU8[0] !== 255 || HEAPU8[3] !== 0) throw 'Typed arrays 2 must be run on a little-endian system';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;




// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 1712;
  /* global initializers */  __ATINIT__.push();
  

memoryInitializer = "a.out.js.mem";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

   
  Module["_memset"] = _memset;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _abort() {
      Module['abort']();
    }

  function ___lock() {}

  function ___unlock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _pthread_self() {
      //FIXME: assumes only a single thread
      return 0;
    }

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);



function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "_pthread_self": _pthread_self, "___lock": ___lock, "___syscall6": ___syscall6, "___setErrNo": ___setErrNo, "_abort": _abort, "_sbrk": _sbrk, "_time": _time, "_pthread_cleanup_push": _pthread_cleanup_push, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "___syscall140": ___syscall140, "_sysconf": _sysconf, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vi=env.invoke_vi;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var _pthread_self=env._pthread_self;
  var ___lock=env.___lock;
  var ___syscall6=env.___syscall6;
  var ___setErrNo=env.___setErrNo;
  var _abort=env._abort;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___syscall140=env.___syscall140;
  var _sysconf=env._sysconf;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function _malloc($bytes) {
 $bytes = $bytes | 0;
 var $$0 = 0, $$lcssa = 0, $$lcssa141 = 0, $$lcssa142 = 0, $$lcssa144 = 0, $$lcssa147 = 0, $$lcssa149 = 0, $$lcssa151 = 0, $$lcssa153 = 0, $$lcssa155 = 0, $$lcssa157 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i14Z2D = 0, $$pre$phi$i17$iZ2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$rsize$4$i = 0, $100 = 0, $1001 = 0, $1006 = 0, $101 = 0, $1012 = 0, $1015 = 0, $1016 = 0, $1034 = 0, $1036 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1053 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $107 = 0, $111 = 0, $113 = 0, $114 = 0, $116 = 0, $118 = 0, $12 = 0, $120 = 0, $122 = 0, $124 = 0, $126 = 0, $128 = 0, $133 = 0, $139 = 0, $14 = 0, $142 = 0, $145 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $152 = 0, $155 = 0, $157 = 0, $16 = 0, $160 = 0, $162 = 0, $165 = 0, $168 = 0, $169 = 0, $17 = 0, $171 = 0, $172 = 0, $174 = 0, $175 = 0, $177 = 0, $178 = 0, $18 = 0, $183 = 0, $184 = 0, $193 = 0, $198 = 0, $202 = 0, $208 = 0, $215 = 0, $219 = 0, $227 = 0, $229 = 0, $230 = 0, $232 = 0, $233 = 0, $234 = 0, $238 = 0, $239 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $251 = 0, $252 = 0, $257 = 0, $258 = 0, $261 = 0, $263 = 0, $266 = 0, $271 = 0, $278 = 0, $28 = 0, $287 = 0, $288 = 0, $292 = 0, $298 = 0, $303 = 0, $306 = 0, $310 = 0, $312 = 0, $313 = 0, $315 = 0, $317 = 0, $319 = 0, $32 = 0, $321 = 0, $323 = 0, $325 = 0, $327 = 0, $337 = 0, $338 = 0, $340 = 0, $349 = 0, $35 = 0, $351 = 0, $354 = 0, $356 = 0, $359 = 0, $361 = 0, $364 = 0, $367 = 0, $368 = 0, $370 = 0, $371 = 0, $373 = 0, $374 = 0, $376 = 0, $377 = 0, $382 = 0, $383 = 0, $39 = 0, $392 = 0, $397 = 0, $4 = 0, $401 = 0, $407 = 0, $414 = 0, $418 = 0, $42 = 0, $426 = 0, $429 = 0, $430 = 0, $431 = 0, $435 = 0, $436 = 0, $442 = 0, $447 = 0, $448 = 0, $45 = 0, $451 = 0, $453 = 0, $456 = 0, $461 = 0, $467 = 0, $469 = 0, $47 = 0, $471 = 0, $472 = 0, $48 = 0, $490 = 0, $492 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $509 = 0, $511 = 0, $512 = 0, $514 = 0, $52 = 0, $523 = 0, $527 = 0, $529 = 0, $530 = 0, $531 = 0, $539 = 0, $54 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $550 = 0, $551 = 0, $553 = 0, $555 = 0, $556 = 0, $56 = 0, $562 = 0, $564 = 0, $566 = 0, $573 = 0, $575 = 0, $576 = 0, $577 = 0, $58 = 0, $585 = 0, $586 = 0, $589 = 0, $593 = 0, $597 = 0, $599 = 0, $6 = 0, $60 = 0, $605 = 0, $609 = 0, $613 = 0, $62 = 0, $622 = 0, $623 = 0, $629 = 0, $632 = 0, $635 = 0, $637 = 0, $642 = 0, $648 = 0, $65 = 0, $653 = 0, $654 = 0, $655 = 0, $661 = 0, $662 = 0, $663 = 0, $67 = 0, $678 = 0, $68 = 0, $683 = 0, $684 = 0, $686 = 0, $69 = 0, $692 = 0, $694 = 0, $7 = 0, $70 = 0, $704 = 0, $708 = 0, $71 = 0, $714 = 0, $716 = 0, $722 = 0, $726 = 0, $727 = 0, $732 = 0, $738 = 0, $743 = 0, $746 = 0, $747 = 0, $750 = 0, $752 = 0, $754 = 0, $757 = 0, $768 = 0, $773 = 0, $775 = 0, $778 = 0, $78 = 0, $780 = 0, $783 = 0, $786 = 0, $787 = 0, $788 = 0, $790 = 0, $792 = 0, $793 = 0, $795 = 0, $796 = 0, $801 = 0, $802 = 0, $811 = 0, $816 = 0, $819 = 0, $82 = 0, $820 = 0, $826 = 0, $834 = 0, $840 = 0, $843 = 0, $844 = 0, $845 = 0, $849 = 0, $85 = 0, $850 = 0, $856 = 0, $861 = 0, $862 = 0, $865 = 0, $867 = 0, $870 = 0, $875 = 0, $881 = 0, $883 = 0, $885 = 0, $886 = 0, $89 = 0, $904 = 0, $906 = 0, $91 = 0, $913 = 0, $914 = 0, $915 = 0, $92 = 0, $922 = 0, $926 = 0, $930 = 0, $932 = 0, $938 = 0, $939 = 0, $94 = 0, $941 = 0, $942 = 0, $946 = 0, $95 = 0, $951 = 0, $952 = 0, $953 = 0, $959 = 0, $96 = 0, $966 = 0, $971 = 0, $974 = 0, $975 = 0, $976 = 0, $980 = 0, $981 = 0, $987 = 0, $992 = 0, $993 = 0, $996 = 0, $998 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$0$i = 0, $K2$0$i$i = 0, $K8$0$i$i = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i$i$lcssa = 0, $R$1$i$lcssa = 0, $R$1$i9 = 0, $R$1$i9$lcssa = 0, $R$3$i = 0, $R$3$i$i = 0, $R$3$i11 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i$i$lcssa = 0, $RP$1$i$lcssa = 0, $RP$1$i8 = 0, $RP$1$i8$lcssa = 0, $T$0$i = 0, $T$0$i$i = 0, $T$0$i$i$lcssa = 0, $T$0$i$i$lcssa140 = 0, $T$0$i$lcssa = 0, $T$0$i$lcssa156 = 0, $T$0$i18$i = 0, $T$0$i18$i$lcssa = 0, $T$0$i18$i$lcssa139 = 0, $br$2$ph$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $nb$0 = 0, $oldfirst$0$i$i = 0, $p$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i5 = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$412$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$068$i = 0, $sp$068$i$lcssa = 0, $sp$167$i = 0, $sp$167$i$lcssa = 0, $ssize$0$i = 0, $ssize$2$ph$i = 0, $ssize$5$i = 0, $t$0$i = 0, $t$0$i4 = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$411$i = 0, $tbase$746$i = 0, $tsize$745$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i6 = 0, $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$413$i = 0, label = 0;
 do if ($bytes >>> 0 < 245) {
  $4 = $bytes >>> 0 < 11 ? 16 : $bytes + 11 & -8;
  $5 = $4 >>> 3;
  $6 = HEAP32[43] | 0;
  $7 = $6 >>> $5;
  if ($7 & 3 | 0) {
   $12 = ($7 & 1 ^ 1) + $5 | 0;
   $14 = 212 + ($12 << 1 << 2) | 0;
   $15 = $14 + 8 | 0;
   $16 = HEAP32[$15 >> 2] | 0;
   $17 = $16 + 8 | 0;
   $18 = HEAP32[$17 >> 2] | 0;
   do if (($14 | 0) == ($18 | 0)) HEAP32[43] = $6 & ~(1 << $12); else {
    if ($18 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
    $25 = $18 + 12 | 0;
    if ((HEAP32[$25 >> 2] | 0) == ($16 | 0)) {
     HEAP32[$25 >> 2] = $14;
     HEAP32[$15 >> 2] = $18;
     break;
    } else _abort();
   } while (0);
   $28 = $12 << 3;
   HEAP32[$16 + 4 >> 2] = $28 | 3;
   $32 = $16 + $28 + 4 | 0;
   HEAP32[$32 >> 2] = HEAP32[$32 >> 2] | 1;
   $$0 = $17;
   return $$0 | 0;
  }
  $35 = HEAP32[45] | 0;
  if ($4 >>> 0 > $35 >>> 0) {
   if ($7 | 0) {
    $39 = 2 << $5;
    $42 = $7 << $5 & ($39 | 0 - $39);
    $45 = ($42 & 0 - $42) + -1 | 0;
    $47 = $45 >>> 12 & 16;
    $48 = $45 >>> $47;
    $50 = $48 >>> 5 & 8;
    $52 = $48 >>> $50;
    $54 = $52 >>> 2 & 4;
    $56 = $52 >>> $54;
    $58 = $56 >>> 1 & 2;
    $60 = $56 >>> $58;
    $62 = $60 >>> 1 & 1;
    $65 = ($50 | $47 | $54 | $58 | $62) + ($60 >>> $62) | 0;
    $67 = 212 + ($65 << 1 << 2) | 0;
    $68 = $67 + 8 | 0;
    $69 = HEAP32[$68 >> 2] | 0;
    $70 = $69 + 8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    do if (($67 | 0) == ($71 | 0)) {
     HEAP32[43] = $6 & ~(1 << $65);
     $89 = $35;
    } else {
     if ($71 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
     $78 = $71 + 12 | 0;
     if ((HEAP32[$78 >> 2] | 0) == ($69 | 0)) {
      HEAP32[$78 >> 2] = $67;
      HEAP32[$68 >> 2] = $71;
      $89 = HEAP32[45] | 0;
      break;
     } else _abort();
    } while (0);
    $82 = ($65 << 3) - $4 | 0;
    HEAP32[$69 + 4 >> 2] = $4 | 3;
    $85 = $69 + $4 | 0;
    HEAP32[$85 + 4 >> 2] = $82 | 1;
    HEAP32[$85 + $82 >> 2] = $82;
    if ($89 | 0) {
     $91 = HEAP32[48] | 0;
     $92 = $89 >>> 3;
     $94 = 212 + ($92 << 1 << 2) | 0;
     $95 = HEAP32[43] | 0;
     $96 = 1 << $92;
     if (!($95 & $96)) {
      HEAP32[43] = $95 | $96;
      $$pre$phiZ2D = $94 + 8 | 0;
      $F4$0 = $94;
     } else {
      $100 = $94 + 8 | 0;
      $101 = HEAP32[$100 >> 2] | 0;
      if ($101 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
       $$pre$phiZ2D = $100;
       $F4$0 = $101;
      }
     }
     HEAP32[$$pre$phiZ2D >> 2] = $91;
     HEAP32[$F4$0 + 12 >> 2] = $91;
     HEAP32[$91 + 8 >> 2] = $F4$0;
     HEAP32[$91 + 12 >> 2] = $94;
    }
    HEAP32[45] = $82;
    HEAP32[48] = $85;
    $$0 = $70;
    return $$0 | 0;
   }
   $107 = HEAP32[44] | 0;
   if (!$107) $nb$0 = $4; else {
    $111 = ($107 & 0 - $107) + -1 | 0;
    $113 = $111 >>> 12 & 16;
    $114 = $111 >>> $113;
    $116 = $114 >>> 5 & 8;
    $118 = $114 >>> $116;
    $120 = $118 >>> 2 & 4;
    $122 = $118 >>> $120;
    $124 = $122 >>> 1 & 2;
    $126 = $122 >>> $124;
    $128 = $126 >>> 1 & 1;
    $133 = HEAP32[476 + (($116 | $113 | $120 | $124 | $128) + ($126 >>> $128) << 2) >> 2] | 0;
    $rsize$0$i = (HEAP32[$133 + 4 >> 2] & -8) - $4 | 0;
    $t$0$i = $133;
    $v$0$i = $133;
    while (1) {
     $139 = HEAP32[$t$0$i + 16 >> 2] | 0;
     if (!$139) {
      $142 = HEAP32[$t$0$i + 20 >> 2] | 0;
      if (!$142) {
       $rsize$0$i$lcssa = $rsize$0$i;
       $v$0$i$lcssa = $v$0$i;
       break;
      } else $145 = $142;
     } else $145 = $139;
     $148 = (HEAP32[$145 + 4 >> 2] & -8) - $4 | 0;
     $149 = $148 >>> 0 < $rsize$0$i >>> 0;
     $rsize$0$i = $149 ? $148 : $rsize$0$i;
     $t$0$i = $145;
     $v$0$i = $149 ? $145 : $v$0$i;
    }
    $150 = HEAP32[47] | 0;
    if ($v$0$i$lcssa >>> 0 < $150 >>> 0) _abort();
    $152 = $v$0$i$lcssa + $4 | 0;
    if ($v$0$i$lcssa >>> 0 >= $152 >>> 0) _abort();
    $155 = HEAP32[$v$0$i$lcssa + 24 >> 2] | 0;
    $157 = HEAP32[$v$0$i$lcssa + 12 >> 2] | 0;
    do if (($157 | 0) == ($v$0$i$lcssa | 0)) {
     $168 = $v$0$i$lcssa + 20 | 0;
     $169 = HEAP32[$168 >> 2] | 0;
     if (!$169) {
      $171 = $v$0$i$lcssa + 16 | 0;
      $172 = HEAP32[$171 >> 2] | 0;
      if (!$172) {
       $R$3$i = 0;
       break;
      } else {
       $R$1$i = $172;
       $RP$1$i = $171;
      }
     } else {
      $R$1$i = $169;
      $RP$1$i = $168;
     }
     while (1) {
      $174 = $R$1$i + 20 | 0;
      $175 = HEAP32[$174 >> 2] | 0;
      if ($175 | 0) {
       $R$1$i = $175;
       $RP$1$i = $174;
       continue;
      }
      $177 = $R$1$i + 16 | 0;
      $178 = HEAP32[$177 >> 2] | 0;
      if (!$178) {
       $R$1$i$lcssa = $R$1$i;
       $RP$1$i$lcssa = $RP$1$i;
       break;
      } else {
       $R$1$i = $178;
       $RP$1$i = $177;
      }
     }
     if ($RP$1$i$lcssa >>> 0 < $150 >>> 0) _abort(); else {
      HEAP32[$RP$1$i$lcssa >> 2] = 0;
      $R$3$i = $R$1$i$lcssa;
      break;
     }
    } else {
     $160 = HEAP32[$v$0$i$lcssa + 8 >> 2] | 0;
     if ($160 >>> 0 < $150 >>> 0) _abort();
     $162 = $160 + 12 | 0;
     if ((HEAP32[$162 >> 2] | 0) != ($v$0$i$lcssa | 0)) _abort();
     $165 = $157 + 8 | 0;
     if ((HEAP32[$165 >> 2] | 0) == ($v$0$i$lcssa | 0)) {
      HEAP32[$162 >> 2] = $157;
      HEAP32[$165 >> 2] = $160;
      $R$3$i = $157;
      break;
     } else _abort();
    } while (0);
    do if ($155 | 0) {
     $183 = HEAP32[$v$0$i$lcssa + 28 >> 2] | 0;
     $184 = 476 + ($183 << 2) | 0;
     if (($v$0$i$lcssa | 0) == (HEAP32[$184 >> 2] | 0)) {
      HEAP32[$184 >> 2] = $R$3$i;
      if (!$R$3$i) {
       HEAP32[44] = HEAP32[44] & ~(1 << $183);
       break;
      }
     } else {
      if ($155 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
      $193 = $155 + 16 | 0;
      if ((HEAP32[$193 >> 2] | 0) == ($v$0$i$lcssa | 0)) HEAP32[$193 >> 2] = $R$3$i; else HEAP32[$155 + 20 >> 2] = $R$3$i;
      if (!$R$3$i) break;
     }
     $198 = HEAP32[47] | 0;
     if ($R$3$i >>> 0 < $198 >>> 0) _abort();
     HEAP32[$R$3$i + 24 >> 2] = $155;
     $202 = HEAP32[$v$0$i$lcssa + 16 >> 2] | 0;
     do if ($202 | 0) if ($202 >>> 0 < $198 >>> 0) _abort(); else {
      HEAP32[$R$3$i + 16 >> 2] = $202;
      HEAP32[$202 + 24 >> 2] = $R$3$i;
      break;
     } while (0);
     $208 = HEAP32[$v$0$i$lcssa + 20 >> 2] | 0;
     if ($208 | 0) if ($208 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
      HEAP32[$R$3$i + 20 >> 2] = $208;
      HEAP32[$208 + 24 >> 2] = $R$3$i;
      break;
     }
    } while (0);
    if ($rsize$0$i$lcssa >>> 0 < 16) {
     $215 = $rsize$0$i$lcssa + $4 | 0;
     HEAP32[$v$0$i$lcssa + 4 >> 2] = $215 | 3;
     $219 = $v$0$i$lcssa + $215 + 4 | 0;
     HEAP32[$219 >> 2] = HEAP32[$219 >> 2] | 1;
    } else {
     HEAP32[$v$0$i$lcssa + 4 >> 2] = $4 | 3;
     HEAP32[$152 + 4 >> 2] = $rsize$0$i$lcssa | 1;
     HEAP32[$152 + $rsize$0$i$lcssa >> 2] = $rsize$0$i$lcssa;
     $227 = HEAP32[45] | 0;
     if ($227 | 0) {
      $229 = HEAP32[48] | 0;
      $230 = $227 >>> 3;
      $232 = 212 + ($230 << 1 << 2) | 0;
      $233 = HEAP32[43] | 0;
      $234 = 1 << $230;
      if (!($233 & $234)) {
       HEAP32[43] = $233 | $234;
       $$pre$phi$iZ2D = $232 + 8 | 0;
       $F1$0$i = $232;
      } else {
       $238 = $232 + 8 | 0;
       $239 = HEAP32[$238 >> 2] | 0;
       if ($239 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
        $$pre$phi$iZ2D = $238;
        $F1$0$i = $239;
       }
      }
      HEAP32[$$pre$phi$iZ2D >> 2] = $229;
      HEAP32[$F1$0$i + 12 >> 2] = $229;
      HEAP32[$229 + 8 >> 2] = $F1$0$i;
      HEAP32[$229 + 12 >> 2] = $232;
     }
     HEAP32[45] = $rsize$0$i$lcssa;
     HEAP32[48] = $152;
    }
    $$0 = $v$0$i$lcssa + 8 | 0;
    return $$0 | 0;
   }
  } else $nb$0 = $4;
 } else if ($bytes >>> 0 > 4294967231) $nb$0 = -1; else {
  $247 = $bytes + 11 | 0;
  $248 = $247 & -8;
  $249 = HEAP32[44] | 0;
  if (!$249) $nb$0 = $248; else {
   $251 = 0 - $248 | 0;
   $252 = $247 >>> 8;
   if (!$252) $idx$0$i = 0; else if ($248 >>> 0 > 16777215) $idx$0$i = 31; else {
    $257 = ($252 + 1048320 | 0) >>> 16 & 8;
    $258 = $252 << $257;
    $261 = ($258 + 520192 | 0) >>> 16 & 4;
    $263 = $258 << $261;
    $266 = ($263 + 245760 | 0) >>> 16 & 2;
    $271 = 14 - ($261 | $257 | $266) + ($263 << $266 >>> 15) | 0;
    $idx$0$i = $248 >>> ($271 + 7 | 0) & 1 | $271 << 1;
   }
   $278 = HEAP32[476 + ($idx$0$i << 2) >> 2] | 0;
   L123 : do if (!$278) {
    $rsize$3$i = $251;
    $t$2$i = 0;
    $v$3$i = 0;
    label = 86;
   } else {
    $rsize$0$i5 = $251;
    $rst$0$i = 0;
    $sizebits$0$i = $248 << (($idx$0$i | 0) == 31 ? 0 : 25 - ($idx$0$i >>> 1) | 0);
    $t$0$i4 = $278;
    $v$0$i6 = 0;
    while (1) {
     $287 = HEAP32[$t$0$i4 + 4 >> 2] & -8;
     $288 = $287 - $248 | 0;
     if ($288 >>> 0 < $rsize$0$i5 >>> 0) if (($287 | 0) == ($248 | 0)) {
      $rsize$412$i = $288;
      $t$411$i = $t$0$i4;
      $v$413$i = $t$0$i4;
      label = 90;
      break L123;
     } else {
      $rsize$1$i = $288;
      $v$1$i = $t$0$i4;
     } else {
      $rsize$1$i = $rsize$0$i5;
      $v$1$i = $v$0$i6;
     }
     $292 = HEAP32[$t$0$i4 + 20 >> 2] | 0;
     $t$0$i4 = HEAP32[$t$0$i4 + 16 + ($sizebits$0$i >>> 31 << 2) >> 2] | 0;
     $rst$1$i = ($292 | 0) == 0 | ($292 | 0) == ($t$0$i4 | 0) ? $rst$0$i : $292;
     $298 = ($t$0$i4 | 0) == 0;
     if ($298) {
      $rsize$3$i = $rsize$1$i;
      $t$2$i = $rst$1$i;
      $v$3$i = $v$1$i;
      label = 86;
      break;
     } else {
      $rsize$0$i5 = $rsize$1$i;
      $rst$0$i = $rst$1$i;
      $sizebits$0$i = $sizebits$0$i << ($298 & 1 ^ 1);
      $v$0$i6 = $v$1$i;
     }
    }
   } while (0);
   if ((label | 0) == 86) {
    if (($t$2$i | 0) == 0 & ($v$3$i | 0) == 0) {
     $303 = 2 << $idx$0$i;
     $306 = $249 & ($303 | 0 - $303);
     if (!$306) {
      $nb$0 = $248;
      break;
     }
     $310 = ($306 & 0 - $306) + -1 | 0;
     $312 = $310 >>> 12 & 16;
     $313 = $310 >>> $312;
     $315 = $313 >>> 5 & 8;
     $317 = $313 >>> $315;
     $319 = $317 >>> 2 & 4;
     $321 = $317 >>> $319;
     $323 = $321 >>> 1 & 2;
     $325 = $321 >>> $323;
     $327 = $325 >>> 1 & 1;
     $t$4$ph$i = HEAP32[476 + (($315 | $312 | $319 | $323 | $327) + ($325 >>> $327) << 2) >> 2] | 0;
    } else $t$4$ph$i = $t$2$i;
    if (!$t$4$ph$i) {
     $rsize$4$lcssa$i = $rsize$3$i;
     $v$4$lcssa$i = $v$3$i;
    } else {
     $rsize$412$i = $rsize$3$i;
     $t$411$i = $t$4$ph$i;
     $v$413$i = $v$3$i;
     label = 90;
    }
   }
   if ((label | 0) == 90) while (1) {
    label = 0;
    $337 = (HEAP32[$t$411$i + 4 >> 2] & -8) - $248 | 0;
    $338 = $337 >>> 0 < $rsize$412$i >>> 0;
    $$rsize$4$i = $338 ? $337 : $rsize$412$i;
    $t$4$v$4$i = $338 ? $t$411$i : $v$413$i;
    $340 = HEAP32[$t$411$i + 16 >> 2] | 0;
    if ($340 | 0) {
     $rsize$412$i = $$rsize$4$i;
     $t$411$i = $340;
     $v$413$i = $t$4$v$4$i;
     label = 90;
     continue;
    }
    $t$411$i = HEAP32[$t$411$i + 20 >> 2] | 0;
    if (!$t$411$i) {
     $rsize$4$lcssa$i = $$rsize$4$i;
     $v$4$lcssa$i = $t$4$v$4$i;
     break;
    } else {
     $rsize$412$i = $$rsize$4$i;
     $v$413$i = $t$4$v$4$i;
     label = 90;
    }
   }
   if (!$v$4$lcssa$i) $nb$0 = $248; else if ($rsize$4$lcssa$i >>> 0 < ((HEAP32[45] | 0) - $248 | 0) >>> 0) {
    $349 = HEAP32[47] | 0;
    if ($v$4$lcssa$i >>> 0 < $349 >>> 0) _abort();
    $351 = $v$4$lcssa$i + $248 | 0;
    if ($v$4$lcssa$i >>> 0 >= $351 >>> 0) _abort();
    $354 = HEAP32[$v$4$lcssa$i + 24 >> 2] | 0;
    $356 = HEAP32[$v$4$lcssa$i + 12 >> 2] | 0;
    do if (($356 | 0) == ($v$4$lcssa$i | 0)) {
     $367 = $v$4$lcssa$i + 20 | 0;
     $368 = HEAP32[$367 >> 2] | 0;
     if (!$368) {
      $370 = $v$4$lcssa$i + 16 | 0;
      $371 = HEAP32[$370 >> 2] | 0;
      if (!$371) {
       $R$3$i11 = 0;
       break;
      } else {
       $R$1$i9 = $371;
       $RP$1$i8 = $370;
      }
     } else {
      $R$1$i9 = $368;
      $RP$1$i8 = $367;
     }
     while (1) {
      $373 = $R$1$i9 + 20 | 0;
      $374 = HEAP32[$373 >> 2] | 0;
      if ($374 | 0) {
       $R$1$i9 = $374;
       $RP$1$i8 = $373;
       continue;
      }
      $376 = $R$1$i9 + 16 | 0;
      $377 = HEAP32[$376 >> 2] | 0;
      if (!$377) {
       $R$1$i9$lcssa = $R$1$i9;
       $RP$1$i8$lcssa = $RP$1$i8;
       break;
      } else {
       $R$1$i9 = $377;
       $RP$1$i8 = $376;
      }
     }
     if ($RP$1$i8$lcssa >>> 0 < $349 >>> 0) _abort(); else {
      HEAP32[$RP$1$i8$lcssa >> 2] = 0;
      $R$3$i11 = $R$1$i9$lcssa;
      break;
     }
    } else {
     $359 = HEAP32[$v$4$lcssa$i + 8 >> 2] | 0;
     if ($359 >>> 0 < $349 >>> 0) _abort();
     $361 = $359 + 12 | 0;
     if ((HEAP32[$361 >> 2] | 0) != ($v$4$lcssa$i | 0)) _abort();
     $364 = $356 + 8 | 0;
     if ((HEAP32[$364 >> 2] | 0) == ($v$4$lcssa$i | 0)) {
      HEAP32[$361 >> 2] = $356;
      HEAP32[$364 >> 2] = $359;
      $R$3$i11 = $356;
      break;
     } else _abort();
    } while (0);
    do if ($354 | 0) {
     $382 = HEAP32[$v$4$lcssa$i + 28 >> 2] | 0;
     $383 = 476 + ($382 << 2) | 0;
     if (($v$4$lcssa$i | 0) == (HEAP32[$383 >> 2] | 0)) {
      HEAP32[$383 >> 2] = $R$3$i11;
      if (!$R$3$i11) {
       HEAP32[44] = HEAP32[44] & ~(1 << $382);
       break;
      }
     } else {
      if ($354 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
      $392 = $354 + 16 | 0;
      if ((HEAP32[$392 >> 2] | 0) == ($v$4$lcssa$i | 0)) HEAP32[$392 >> 2] = $R$3$i11; else HEAP32[$354 + 20 >> 2] = $R$3$i11;
      if (!$R$3$i11) break;
     }
     $397 = HEAP32[47] | 0;
     if ($R$3$i11 >>> 0 < $397 >>> 0) _abort();
     HEAP32[$R$3$i11 + 24 >> 2] = $354;
     $401 = HEAP32[$v$4$lcssa$i + 16 >> 2] | 0;
     do if ($401 | 0) if ($401 >>> 0 < $397 >>> 0) _abort(); else {
      HEAP32[$R$3$i11 + 16 >> 2] = $401;
      HEAP32[$401 + 24 >> 2] = $R$3$i11;
      break;
     } while (0);
     $407 = HEAP32[$v$4$lcssa$i + 20 >> 2] | 0;
     if ($407 | 0) if ($407 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
      HEAP32[$R$3$i11 + 20 >> 2] = $407;
      HEAP32[$407 + 24 >> 2] = $R$3$i11;
      break;
     }
    } while (0);
    do if ($rsize$4$lcssa$i >>> 0 < 16) {
     $414 = $rsize$4$lcssa$i + $248 | 0;
     HEAP32[$v$4$lcssa$i + 4 >> 2] = $414 | 3;
     $418 = $v$4$lcssa$i + $414 + 4 | 0;
     HEAP32[$418 >> 2] = HEAP32[$418 >> 2] | 1;
    } else {
     HEAP32[$v$4$lcssa$i + 4 >> 2] = $248 | 3;
     HEAP32[$351 + 4 >> 2] = $rsize$4$lcssa$i | 1;
     HEAP32[$351 + $rsize$4$lcssa$i >> 2] = $rsize$4$lcssa$i;
     $426 = $rsize$4$lcssa$i >>> 3;
     if ($rsize$4$lcssa$i >>> 0 < 256) {
      $429 = 212 + ($426 << 1 << 2) | 0;
      $430 = HEAP32[43] | 0;
      $431 = 1 << $426;
      if (!($430 & $431)) {
       HEAP32[43] = $430 | $431;
       $$pre$phi$i14Z2D = $429 + 8 | 0;
       $F5$0$i = $429;
      } else {
       $435 = $429 + 8 | 0;
       $436 = HEAP32[$435 >> 2] | 0;
       if ($436 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
        $$pre$phi$i14Z2D = $435;
        $F5$0$i = $436;
       }
      }
      HEAP32[$$pre$phi$i14Z2D >> 2] = $351;
      HEAP32[$F5$0$i + 12 >> 2] = $351;
      HEAP32[$351 + 8 >> 2] = $F5$0$i;
      HEAP32[$351 + 12 >> 2] = $429;
      break;
     }
     $442 = $rsize$4$lcssa$i >>> 8;
     if (!$442) $I7$0$i = 0; else if ($rsize$4$lcssa$i >>> 0 > 16777215) $I7$0$i = 31; else {
      $447 = ($442 + 1048320 | 0) >>> 16 & 8;
      $448 = $442 << $447;
      $451 = ($448 + 520192 | 0) >>> 16 & 4;
      $453 = $448 << $451;
      $456 = ($453 + 245760 | 0) >>> 16 & 2;
      $461 = 14 - ($451 | $447 | $456) + ($453 << $456 >>> 15) | 0;
      $I7$0$i = $rsize$4$lcssa$i >>> ($461 + 7 | 0) & 1 | $461 << 1;
     }
     $467 = 476 + ($I7$0$i << 2) | 0;
     HEAP32[$351 + 28 >> 2] = $I7$0$i;
     $469 = $351 + 16 | 0;
     HEAP32[$469 + 4 >> 2] = 0;
     HEAP32[$469 >> 2] = 0;
     $471 = HEAP32[44] | 0;
     $472 = 1 << $I7$0$i;
     if (!($471 & $472)) {
      HEAP32[44] = $471 | $472;
      HEAP32[$467 >> 2] = $351;
      HEAP32[$351 + 24 >> 2] = $467;
      HEAP32[$351 + 12 >> 2] = $351;
      HEAP32[$351 + 8 >> 2] = $351;
      break;
     }
     $K12$0$i = $rsize$4$lcssa$i << (($I7$0$i | 0) == 31 ? 0 : 25 - ($I7$0$i >>> 1) | 0);
     $T$0$i = HEAP32[$467 >> 2] | 0;
     while (1) {
      if ((HEAP32[$T$0$i + 4 >> 2] & -8 | 0) == ($rsize$4$lcssa$i | 0)) {
       $T$0$i$lcssa = $T$0$i;
       label = 148;
       break;
      }
      $490 = $T$0$i + 16 + ($K12$0$i >>> 31 << 2) | 0;
      $492 = HEAP32[$490 >> 2] | 0;
      if (!$492) {
       $$lcssa157 = $490;
       $T$0$i$lcssa156 = $T$0$i;
       label = 145;
       break;
      } else {
       $K12$0$i = $K12$0$i << 1;
       $T$0$i = $492;
      }
     }
     if ((label | 0) == 145) if ($$lcssa157 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
      HEAP32[$$lcssa157 >> 2] = $351;
      HEAP32[$351 + 24 >> 2] = $T$0$i$lcssa156;
      HEAP32[$351 + 12 >> 2] = $351;
      HEAP32[$351 + 8 >> 2] = $351;
      break;
     } else if ((label | 0) == 148) {
      $499 = $T$0$i$lcssa + 8 | 0;
      $500 = HEAP32[$499 >> 2] | 0;
      $501 = HEAP32[47] | 0;
      if ($500 >>> 0 >= $501 >>> 0 & $T$0$i$lcssa >>> 0 >= $501 >>> 0) {
       HEAP32[$500 + 12 >> 2] = $351;
       HEAP32[$499 >> 2] = $351;
       HEAP32[$351 + 8 >> 2] = $500;
       HEAP32[$351 + 12 >> 2] = $T$0$i$lcssa;
       HEAP32[$351 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $v$4$lcssa$i + 8 | 0;
    return $$0 | 0;
   } else $nb$0 = $248;
  }
 } while (0);
 $509 = HEAP32[45] | 0;
 if ($509 >>> 0 >= $nb$0 >>> 0) {
  $511 = $509 - $nb$0 | 0;
  $512 = HEAP32[48] | 0;
  if ($511 >>> 0 > 15) {
   $514 = $512 + $nb$0 | 0;
   HEAP32[48] = $514;
   HEAP32[45] = $511;
   HEAP32[$514 + 4 >> 2] = $511 | 1;
   HEAP32[$514 + $511 >> 2] = $511;
   HEAP32[$512 + 4 >> 2] = $nb$0 | 3;
  } else {
   HEAP32[45] = 0;
   HEAP32[48] = 0;
   HEAP32[$512 + 4 >> 2] = $509 | 3;
   $523 = $512 + $509 + 4 | 0;
   HEAP32[$523 >> 2] = HEAP32[$523 >> 2] | 1;
  }
  $$0 = $512 + 8 | 0;
  return $$0 | 0;
 }
 $527 = HEAP32[46] | 0;
 if ($527 >>> 0 > $nb$0 >>> 0) {
  $529 = $527 - $nb$0 | 0;
  HEAP32[46] = $529;
  $530 = HEAP32[49] | 0;
  $531 = $530 + $nb$0 | 0;
  HEAP32[49] = $531;
  HEAP32[$531 + 4 >> 2] = $529 | 1;
  HEAP32[$530 + 4 >> 2] = $nb$0 | 3;
  $$0 = $530 + 8 | 0;
  return $$0 | 0;
 }
 do if (!(HEAP32[161] | 0)) {
  $539 = _sysconf(30) | 0;
  if (!($539 + -1 & $539)) {
   HEAP32[163] = $539;
   HEAP32[162] = $539;
   HEAP32[164] = -1;
   HEAP32[165] = -1;
   HEAP32[166] = 0;
   HEAP32[154] = 0;
   HEAP32[161] = (_time(0) | 0) & -16 ^ 1431655768;
   break;
  } else _abort();
 } while (0);
 $546 = $nb$0 + 48 | 0;
 $547 = HEAP32[163] | 0;
 $548 = $nb$0 + 47 | 0;
 $549 = $547 + $548 | 0;
 $550 = 0 - $547 | 0;
 $551 = $549 & $550;
 if ($551 >>> 0 <= $nb$0 >>> 0) {
  $$0 = 0;
  return $$0 | 0;
 }
 $553 = HEAP32[153] | 0;
 if ($553 | 0) {
  $555 = HEAP32[151] | 0;
  $556 = $555 + $551 | 0;
  if ($556 >>> 0 <= $555 >>> 0 | $556 >>> 0 > $553 >>> 0) {
   $$0 = 0;
   return $$0 | 0;
  }
 }
 L257 : do if (!(HEAP32[154] & 4)) {
  $562 = HEAP32[49] | 0;
  L259 : do if (!$562) label = 173; else {
   $sp$0$i$i = 620;
   while (1) {
    $564 = HEAP32[$sp$0$i$i >> 2] | 0;
    if ($564 >>> 0 <= $562 >>> 0) {
     $566 = $sp$0$i$i + 4 | 0;
     if (($564 + (HEAP32[$566 >> 2] | 0) | 0) >>> 0 > $562 >>> 0) {
      $$lcssa153 = $sp$0$i$i;
      $$lcssa155 = $566;
      break;
     }
    }
    $sp$0$i$i = HEAP32[$sp$0$i$i + 8 >> 2] | 0;
    if (!$sp$0$i$i) {
     label = 173;
     break L259;
    }
   }
   $597 = $549 - (HEAP32[46] | 0) & $550;
   if ($597 >>> 0 < 2147483647) {
    $599 = _sbrk($597 | 0) | 0;
    if (($599 | 0) == ((HEAP32[$$lcssa153 >> 2] | 0) + (HEAP32[$$lcssa155 >> 2] | 0) | 0)) {
     if (($599 | 0) != (-1 | 0)) {
      $tbase$746$i = $599;
      $tsize$745$i = $597;
      label = 193;
      break L257;
     }
    } else {
     $br$2$ph$i = $599;
     $ssize$2$ph$i = $597;
     label = 183;
    }
   }
  } while (0);
  do if ((label | 0) == 173) {
   $573 = _sbrk(0) | 0;
   if (($573 | 0) != (-1 | 0)) {
    $575 = $573;
    $576 = HEAP32[162] | 0;
    $577 = $576 + -1 | 0;
    if (!($577 & $575)) $ssize$0$i = $551; else $ssize$0$i = $551 - $575 + ($577 + $575 & 0 - $576) | 0;
    $585 = HEAP32[151] | 0;
    $586 = $585 + $ssize$0$i | 0;
    if ($ssize$0$i >>> 0 > $nb$0 >>> 0 & $ssize$0$i >>> 0 < 2147483647) {
     $589 = HEAP32[153] | 0;
     if ($589 | 0) if ($586 >>> 0 <= $585 >>> 0 | $586 >>> 0 > $589 >>> 0) break;
     $593 = _sbrk($ssize$0$i | 0) | 0;
     if (($593 | 0) == ($573 | 0)) {
      $tbase$746$i = $573;
      $tsize$745$i = $ssize$0$i;
      label = 193;
      break L257;
     } else {
      $br$2$ph$i = $593;
      $ssize$2$ph$i = $ssize$0$i;
      label = 183;
     }
    }
   }
  } while (0);
  L279 : do if ((label | 0) == 183) {
   $605 = 0 - $ssize$2$ph$i | 0;
   do if ($546 >>> 0 > $ssize$2$ph$i >>> 0 & ($ssize$2$ph$i >>> 0 < 2147483647 & ($br$2$ph$i | 0) != (-1 | 0))) {
    $609 = HEAP32[163] | 0;
    $613 = $548 - $ssize$2$ph$i + $609 & 0 - $609;
    if ($613 >>> 0 < 2147483647) if ((_sbrk($613 | 0) | 0) == (-1 | 0)) {
     _sbrk($605 | 0) | 0;
     break L279;
    } else {
     $ssize$5$i = $613 + $ssize$2$ph$i | 0;
     break;
    } else $ssize$5$i = $ssize$2$ph$i;
   } else $ssize$5$i = $ssize$2$ph$i; while (0);
   if (($br$2$ph$i | 0) != (-1 | 0)) {
    $tbase$746$i = $br$2$ph$i;
    $tsize$745$i = $ssize$5$i;
    label = 193;
    break L257;
   }
  } while (0);
  HEAP32[154] = HEAP32[154] | 4;
  label = 190;
 } else label = 190; while (0);
 if ((label | 0) == 190) if ($551 >>> 0 < 2147483647) {
  $622 = _sbrk($551 | 0) | 0;
  $623 = _sbrk(0) | 0;
  if ($622 >>> 0 < $623 >>> 0 & (($622 | 0) != (-1 | 0) & ($623 | 0) != (-1 | 0))) {
   $629 = $623 - $622 | 0;
   if ($629 >>> 0 > ($nb$0 + 40 | 0) >>> 0) {
    $tbase$746$i = $622;
    $tsize$745$i = $629;
    label = 193;
   }
  }
 }
 if ((label | 0) == 193) {
  $632 = (HEAP32[151] | 0) + $tsize$745$i | 0;
  HEAP32[151] = $632;
  if ($632 >>> 0 > (HEAP32[152] | 0) >>> 0) HEAP32[152] = $632;
  $635 = HEAP32[49] | 0;
  do if (!$635) {
   $637 = HEAP32[47] | 0;
   if (($637 | 0) == 0 | $tbase$746$i >>> 0 < $637 >>> 0) HEAP32[47] = $tbase$746$i;
   HEAP32[155] = $tbase$746$i;
   HEAP32[156] = $tsize$745$i;
   HEAP32[158] = 0;
   HEAP32[52] = HEAP32[161];
   HEAP32[51] = -1;
   $i$01$i$i = 0;
   do {
    $642 = 212 + ($i$01$i$i << 1 << 2) | 0;
    HEAP32[$642 + 12 >> 2] = $642;
    HEAP32[$642 + 8 >> 2] = $642;
    $i$01$i$i = $i$01$i$i + 1 | 0;
   } while (($i$01$i$i | 0) != 32);
   $648 = $tbase$746$i + 8 | 0;
   $653 = ($648 & 7 | 0) == 0 ? 0 : 0 - $648 & 7;
   $654 = $tbase$746$i + $653 | 0;
   $655 = $tsize$745$i + -40 - $653 | 0;
   HEAP32[49] = $654;
   HEAP32[46] = $655;
   HEAP32[$654 + 4 >> 2] = $655 | 1;
   HEAP32[$654 + $655 + 4 >> 2] = 40;
   HEAP32[50] = HEAP32[165];
  } else {
   $sp$068$i = 620;
   do {
    $661 = HEAP32[$sp$068$i >> 2] | 0;
    $662 = $sp$068$i + 4 | 0;
    $663 = HEAP32[$662 >> 2] | 0;
    if (($tbase$746$i | 0) == ($661 + $663 | 0)) {
     $$lcssa147 = $661;
     $$lcssa149 = $662;
     $$lcssa151 = $663;
     $sp$068$i$lcssa = $sp$068$i;
     label = 203;
     break;
    }
    $sp$068$i = HEAP32[$sp$068$i + 8 >> 2] | 0;
   } while (($sp$068$i | 0) != 0);
   if ((label | 0) == 203) if (!(HEAP32[$sp$068$i$lcssa + 12 >> 2] & 8)) if ($635 >>> 0 < $tbase$746$i >>> 0 & $635 >>> 0 >= $$lcssa147 >>> 0) {
    HEAP32[$$lcssa149 >> 2] = $$lcssa151 + $tsize$745$i;
    $678 = $635 + 8 | 0;
    $683 = ($678 & 7 | 0) == 0 ? 0 : 0 - $678 & 7;
    $684 = $635 + $683 | 0;
    $686 = $tsize$745$i - $683 + (HEAP32[46] | 0) | 0;
    HEAP32[49] = $684;
    HEAP32[46] = $686;
    HEAP32[$684 + 4 >> 2] = $686 | 1;
    HEAP32[$684 + $686 + 4 >> 2] = 40;
    HEAP32[50] = HEAP32[165];
    break;
   }
   $692 = HEAP32[47] | 0;
   if ($tbase$746$i >>> 0 < $692 >>> 0) {
    HEAP32[47] = $tbase$746$i;
    $757 = $tbase$746$i;
   } else $757 = $692;
   $694 = $tbase$746$i + $tsize$745$i | 0;
   $sp$167$i = 620;
   while (1) {
    if ((HEAP32[$sp$167$i >> 2] | 0) == ($694 | 0)) {
     $$lcssa144 = $sp$167$i;
     $sp$167$i$lcssa = $sp$167$i;
     label = 211;
     break;
    }
    $sp$167$i = HEAP32[$sp$167$i + 8 >> 2] | 0;
    if (!$sp$167$i) {
     $sp$0$i$i$i = 620;
     break;
    }
   }
   if ((label | 0) == 211) if (!(HEAP32[$sp$167$i$lcssa + 12 >> 2] & 8)) {
    HEAP32[$$lcssa144 >> 2] = $tbase$746$i;
    $704 = $sp$167$i$lcssa + 4 | 0;
    HEAP32[$704 >> 2] = (HEAP32[$704 >> 2] | 0) + $tsize$745$i;
    $708 = $tbase$746$i + 8 | 0;
    $714 = $tbase$746$i + (($708 & 7 | 0) == 0 ? 0 : 0 - $708 & 7) | 0;
    $716 = $694 + 8 | 0;
    $722 = $694 + (($716 & 7 | 0) == 0 ? 0 : 0 - $716 & 7) | 0;
    $726 = $714 + $nb$0 | 0;
    $727 = $722 - $714 - $nb$0 | 0;
    HEAP32[$714 + 4 >> 2] = $nb$0 | 3;
    do if (($722 | 0) == ($635 | 0)) {
     $732 = (HEAP32[46] | 0) + $727 | 0;
     HEAP32[46] = $732;
     HEAP32[49] = $726;
     HEAP32[$726 + 4 >> 2] = $732 | 1;
    } else {
     if (($722 | 0) == (HEAP32[48] | 0)) {
      $738 = (HEAP32[45] | 0) + $727 | 0;
      HEAP32[45] = $738;
      HEAP32[48] = $726;
      HEAP32[$726 + 4 >> 2] = $738 | 1;
      HEAP32[$726 + $738 >> 2] = $738;
      break;
     }
     $743 = HEAP32[$722 + 4 >> 2] | 0;
     if (($743 & 3 | 0) == 1) {
      $746 = $743 & -8;
      $747 = $743 >>> 3;
      L331 : do if ($743 >>> 0 < 256) {
       $750 = HEAP32[$722 + 8 >> 2] | 0;
       $752 = HEAP32[$722 + 12 >> 2] | 0;
       $754 = 212 + ($747 << 1 << 2) | 0;
       do if (($750 | 0) != ($754 | 0)) {
        if ($750 >>> 0 < $757 >>> 0) _abort();
        if ((HEAP32[$750 + 12 >> 2] | 0) == ($722 | 0)) break;
        _abort();
       } while (0);
       if (($752 | 0) == ($750 | 0)) {
        HEAP32[43] = HEAP32[43] & ~(1 << $747);
        break;
       }
       do if (($752 | 0) == ($754 | 0)) $$pre$phi10$i$iZ2D = $752 + 8 | 0; else {
        if ($752 >>> 0 < $757 >>> 0) _abort();
        $768 = $752 + 8 | 0;
        if ((HEAP32[$768 >> 2] | 0) == ($722 | 0)) {
         $$pre$phi10$i$iZ2D = $768;
         break;
        }
        _abort();
       } while (0);
       HEAP32[$750 + 12 >> 2] = $752;
       HEAP32[$$pre$phi10$i$iZ2D >> 2] = $750;
      } else {
       $773 = HEAP32[$722 + 24 >> 2] | 0;
       $775 = HEAP32[$722 + 12 >> 2] | 0;
       do if (($775 | 0) == ($722 | 0)) {
        $786 = $722 + 16 | 0;
        $787 = $786 + 4 | 0;
        $788 = HEAP32[$787 >> 2] | 0;
        if (!$788) {
         $790 = HEAP32[$786 >> 2] | 0;
         if (!$790) {
          $R$3$i$i = 0;
          break;
         } else {
          $R$1$i$i = $790;
          $RP$1$i$i = $786;
         }
        } else {
         $R$1$i$i = $788;
         $RP$1$i$i = $787;
        }
        while (1) {
         $792 = $R$1$i$i + 20 | 0;
         $793 = HEAP32[$792 >> 2] | 0;
         if ($793 | 0) {
          $R$1$i$i = $793;
          $RP$1$i$i = $792;
          continue;
         }
         $795 = $R$1$i$i + 16 | 0;
         $796 = HEAP32[$795 >> 2] | 0;
         if (!$796) {
          $R$1$i$i$lcssa = $R$1$i$i;
          $RP$1$i$i$lcssa = $RP$1$i$i;
          break;
         } else {
          $R$1$i$i = $796;
          $RP$1$i$i = $795;
         }
        }
        if ($RP$1$i$i$lcssa >>> 0 < $757 >>> 0) _abort(); else {
         HEAP32[$RP$1$i$i$lcssa >> 2] = 0;
         $R$3$i$i = $R$1$i$i$lcssa;
         break;
        }
       } else {
        $778 = HEAP32[$722 + 8 >> 2] | 0;
        if ($778 >>> 0 < $757 >>> 0) _abort();
        $780 = $778 + 12 | 0;
        if ((HEAP32[$780 >> 2] | 0) != ($722 | 0)) _abort();
        $783 = $775 + 8 | 0;
        if ((HEAP32[$783 >> 2] | 0) == ($722 | 0)) {
         HEAP32[$780 >> 2] = $775;
         HEAP32[$783 >> 2] = $778;
         $R$3$i$i = $775;
         break;
        } else _abort();
       } while (0);
       if (!$773) break;
       $801 = HEAP32[$722 + 28 >> 2] | 0;
       $802 = 476 + ($801 << 2) | 0;
       do if (($722 | 0) == (HEAP32[$802 >> 2] | 0)) {
        HEAP32[$802 >> 2] = $R$3$i$i;
        if ($R$3$i$i | 0) break;
        HEAP32[44] = HEAP32[44] & ~(1 << $801);
        break L331;
       } else {
        if ($773 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
        $811 = $773 + 16 | 0;
        if ((HEAP32[$811 >> 2] | 0) == ($722 | 0)) HEAP32[$811 >> 2] = $R$3$i$i; else HEAP32[$773 + 20 >> 2] = $R$3$i$i;
        if (!$R$3$i$i) break L331;
       } while (0);
       $816 = HEAP32[47] | 0;
       if ($R$3$i$i >>> 0 < $816 >>> 0) _abort();
       HEAP32[$R$3$i$i + 24 >> 2] = $773;
       $819 = $722 + 16 | 0;
       $820 = HEAP32[$819 >> 2] | 0;
       do if ($820 | 0) if ($820 >>> 0 < $816 >>> 0) _abort(); else {
        HEAP32[$R$3$i$i + 16 >> 2] = $820;
        HEAP32[$820 + 24 >> 2] = $R$3$i$i;
        break;
       } while (0);
       $826 = HEAP32[$819 + 4 >> 2] | 0;
       if (!$826) break;
       if ($826 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
        HEAP32[$R$3$i$i + 20 >> 2] = $826;
        HEAP32[$826 + 24 >> 2] = $R$3$i$i;
        break;
       }
      } while (0);
      $oldfirst$0$i$i = $722 + $746 | 0;
      $qsize$0$i$i = $746 + $727 | 0;
     } else {
      $oldfirst$0$i$i = $722;
      $qsize$0$i$i = $727;
     }
     $834 = $oldfirst$0$i$i + 4 | 0;
     HEAP32[$834 >> 2] = HEAP32[$834 >> 2] & -2;
     HEAP32[$726 + 4 >> 2] = $qsize$0$i$i | 1;
     HEAP32[$726 + $qsize$0$i$i >> 2] = $qsize$0$i$i;
     $840 = $qsize$0$i$i >>> 3;
     if ($qsize$0$i$i >>> 0 < 256) {
      $843 = 212 + ($840 << 1 << 2) | 0;
      $844 = HEAP32[43] | 0;
      $845 = 1 << $840;
      do if (!($844 & $845)) {
       HEAP32[43] = $844 | $845;
       $$pre$phi$i17$iZ2D = $843 + 8 | 0;
       $F4$0$i$i = $843;
      } else {
       $849 = $843 + 8 | 0;
       $850 = HEAP32[$849 >> 2] | 0;
       if ($850 >>> 0 >= (HEAP32[47] | 0) >>> 0) {
        $$pre$phi$i17$iZ2D = $849;
        $F4$0$i$i = $850;
        break;
       }
       _abort();
      } while (0);
      HEAP32[$$pre$phi$i17$iZ2D >> 2] = $726;
      HEAP32[$F4$0$i$i + 12 >> 2] = $726;
      HEAP32[$726 + 8 >> 2] = $F4$0$i$i;
      HEAP32[$726 + 12 >> 2] = $843;
      break;
     }
     $856 = $qsize$0$i$i >>> 8;
     do if (!$856) $I7$0$i$i = 0; else {
      if ($qsize$0$i$i >>> 0 > 16777215) {
       $I7$0$i$i = 31;
       break;
      }
      $861 = ($856 + 1048320 | 0) >>> 16 & 8;
      $862 = $856 << $861;
      $865 = ($862 + 520192 | 0) >>> 16 & 4;
      $867 = $862 << $865;
      $870 = ($867 + 245760 | 0) >>> 16 & 2;
      $875 = 14 - ($865 | $861 | $870) + ($867 << $870 >>> 15) | 0;
      $I7$0$i$i = $qsize$0$i$i >>> ($875 + 7 | 0) & 1 | $875 << 1;
     } while (0);
     $881 = 476 + ($I7$0$i$i << 2) | 0;
     HEAP32[$726 + 28 >> 2] = $I7$0$i$i;
     $883 = $726 + 16 | 0;
     HEAP32[$883 + 4 >> 2] = 0;
     HEAP32[$883 >> 2] = 0;
     $885 = HEAP32[44] | 0;
     $886 = 1 << $I7$0$i$i;
     if (!($885 & $886)) {
      HEAP32[44] = $885 | $886;
      HEAP32[$881 >> 2] = $726;
      HEAP32[$726 + 24 >> 2] = $881;
      HEAP32[$726 + 12 >> 2] = $726;
      HEAP32[$726 + 8 >> 2] = $726;
      break;
     }
     $K8$0$i$i = $qsize$0$i$i << (($I7$0$i$i | 0) == 31 ? 0 : 25 - ($I7$0$i$i >>> 1) | 0);
     $T$0$i18$i = HEAP32[$881 >> 2] | 0;
     while (1) {
      if ((HEAP32[$T$0$i18$i + 4 >> 2] & -8 | 0) == ($qsize$0$i$i | 0)) {
       $T$0$i18$i$lcssa = $T$0$i18$i;
       label = 281;
       break;
      }
      $904 = $T$0$i18$i + 16 + ($K8$0$i$i >>> 31 << 2) | 0;
      $906 = HEAP32[$904 >> 2] | 0;
      if (!$906) {
       $$lcssa = $904;
       $T$0$i18$i$lcssa139 = $T$0$i18$i;
       label = 278;
       break;
      } else {
       $K8$0$i$i = $K8$0$i$i << 1;
       $T$0$i18$i = $906;
      }
     }
     if ((label | 0) == 278) if ($$lcssa >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
      HEAP32[$$lcssa >> 2] = $726;
      HEAP32[$726 + 24 >> 2] = $T$0$i18$i$lcssa139;
      HEAP32[$726 + 12 >> 2] = $726;
      HEAP32[$726 + 8 >> 2] = $726;
      break;
     } else if ((label | 0) == 281) {
      $913 = $T$0$i18$i$lcssa + 8 | 0;
      $914 = HEAP32[$913 >> 2] | 0;
      $915 = HEAP32[47] | 0;
      if ($914 >>> 0 >= $915 >>> 0 & $T$0$i18$i$lcssa >>> 0 >= $915 >>> 0) {
       HEAP32[$914 + 12 >> 2] = $726;
       HEAP32[$913 >> 2] = $726;
       HEAP32[$726 + 8 >> 2] = $914;
       HEAP32[$726 + 12 >> 2] = $T$0$i18$i$lcssa;
       HEAP32[$726 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $714 + 8 | 0;
    return $$0 | 0;
   } else $sp$0$i$i$i = 620;
   while (1) {
    $922 = HEAP32[$sp$0$i$i$i >> 2] | 0;
    if ($922 >>> 0 <= $635 >>> 0) {
     $926 = $922 + (HEAP32[$sp$0$i$i$i + 4 >> 2] | 0) | 0;
     if ($926 >>> 0 > $635 >>> 0) {
      $$lcssa142 = $926;
      break;
     }
    }
    $sp$0$i$i$i = HEAP32[$sp$0$i$i$i + 8 >> 2] | 0;
   }
   $930 = $$lcssa142 + -47 | 0;
   $932 = $930 + 8 | 0;
   $938 = $930 + (($932 & 7 | 0) == 0 ? 0 : 0 - $932 & 7) | 0;
   $939 = $635 + 16 | 0;
   $941 = $938 >>> 0 < $939 >>> 0 ? $635 : $938;
   $942 = $941 + 8 | 0;
   $946 = $tbase$746$i + 8 | 0;
   $951 = ($946 & 7 | 0) == 0 ? 0 : 0 - $946 & 7;
   $952 = $tbase$746$i + $951 | 0;
   $953 = $tsize$745$i + -40 - $951 | 0;
   HEAP32[49] = $952;
   HEAP32[46] = $953;
   HEAP32[$952 + 4 >> 2] = $953 | 1;
   HEAP32[$952 + $953 + 4 >> 2] = 40;
   HEAP32[50] = HEAP32[165];
   $959 = $941 + 4 | 0;
   HEAP32[$959 >> 2] = 27;
   HEAP32[$942 >> 2] = HEAP32[155];
   HEAP32[$942 + 4 >> 2] = HEAP32[156];
   HEAP32[$942 + 8 >> 2] = HEAP32[157];
   HEAP32[$942 + 12 >> 2] = HEAP32[158];
   HEAP32[155] = $tbase$746$i;
   HEAP32[156] = $tsize$745$i;
   HEAP32[158] = 0;
   HEAP32[157] = $942;
   $p$0$i$i = $941 + 24 | 0;
   do {
    $p$0$i$i = $p$0$i$i + 4 | 0;
    HEAP32[$p$0$i$i >> 2] = 7;
   } while (($p$0$i$i + 4 | 0) >>> 0 < $$lcssa142 >>> 0);
   if (($941 | 0) != ($635 | 0)) {
    $966 = $941 - $635 | 0;
    HEAP32[$959 >> 2] = HEAP32[$959 >> 2] & -2;
    HEAP32[$635 + 4 >> 2] = $966 | 1;
    HEAP32[$941 >> 2] = $966;
    $971 = $966 >>> 3;
    if ($966 >>> 0 < 256) {
     $974 = 212 + ($971 << 1 << 2) | 0;
     $975 = HEAP32[43] | 0;
     $976 = 1 << $971;
     if (!($975 & $976)) {
      HEAP32[43] = $975 | $976;
      $$pre$phi$i$iZ2D = $974 + 8 | 0;
      $F$0$i$i = $974;
     } else {
      $980 = $974 + 8 | 0;
      $981 = HEAP32[$980 >> 2] | 0;
      if ($981 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
       $$pre$phi$i$iZ2D = $980;
       $F$0$i$i = $981;
      }
     }
     HEAP32[$$pre$phi$i$iZ2D >> 2] = $635;
     HEAP32[$F$0$i$i + 12 >> 2] = $635;
     HEAP32[$635 + 8 >> 2] = $F$0$i$i;
     HEAP32[$635 + 12 >> 2] = $974;
     break;
    }
    $987 = $966 >>> 8;
    if (!$987) $I1$0$i$i = 0; else if ($966 >>> 0 > 16777215) $I1$0$i$i = 31; else {
     $992 = ($987 + 1048320 | 0) >>> 16 & 8;
     $993 = $987 << $992;
     $996 = ($993 + 520192 | 0) >>> 16 & 4;
     $998 = $993 << $996;
     $1001 = ($998 + 245760 | 0) >>> 16 & 2;
     $1006 = 14 - ($996 | $992 | $1001) + ($998 << $1001 >>> 15) | 0;
     $I1$0$i$i = $966 >>> ($1006 + 7 | 0) & 1 | $1006 << 1;
    }
    $1012 = 476 + ($I1$0$i$i << 2) | 0;
    HEAP32[$635 + 28 >> 2] = $I1$0$i$i;
    HEAP32[$635 + 20 >> 2] = 0;
    HEAP32[$939 >> 2] = 0;
    $1015 = HEAP32[44] | 0;
    $1016 = 1 << $I1$0$i$i;
    if (!($1015 & $1016)) {
     HEAP32[44] = $1015 | $1016;
     HEAP32[$1012 >> 2] = $635;
     HEAP32[$635 + 24 >> 2] = $1012;
     HEAP32[$635 + 12 >> 2] = $635;
     HEAP32[$635 + 8 >> 2] = $635;
     break;
    }
    $K2$0$i$i = $966 << (($I1$0$i$i | 0) == 31 ? 0 : 25 - ($I1$0$i$i >>> 1) | 0);
    $T$0$i$i = HEAP32[$1012 >> 2] | 0;
    while (1) {
     if ((HEAP32[$T$0$i$i + 4 >> 2] & -8 | 0) == ($966 | 0)) {
      $T$0$i$i$lcssa = $T$0$i$i;
      label = 307;
      break;
     }
     $1034 = $T$0$i$i + 16 + ($K2$0$i$i >>> 31 << 2) | 0;
     $1036 = HEAP32[$1034 >> 2] | 0;
     if (!$1036) {
      $$lcssa141 = $1034;
      $T$0$i$i$lcssa140 = $T$0$i$i;
      label = 304;
      break;
     } else {
      $K2$0$i$i = $K2$0$i$i << 1;
      $T$0$i$i = $1036;
     }
    }
    if ((label | 0) == 304) if ($$lcssa141 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
     HEAP32[$$lcssa141 >> 2] = $635;
     HEAP32[$635 + 24 >> 2] = $T$0$i$i$lcssa140;
     HEAP32[$635 + 12 >> 2] = $635;
     HEAP32[$635 + 8 >> 2] = $635;
     break;
    } else if ((label | 0) == 307) {
     $1043 = $T$0$i$i$lcssa + 8 | 0;
     $1044 = HEAP32[$1043 >> 2] | 0;
     $1045 = HEAP32[47] | 0;
     if ($1044 >>> 0 >= $1045 >>> 0 & $T$0$i$i$lcssa >>> 0 >= $1045 >>> 0) {
      HEAP32[$1044 + 12 >> 2] = $635;
      HEAP32[$1043 >> 2] = $635;
      HEAP32[$635 + 8 >> 2] = $1044;
      HEAP32[$635 + 12 >> 2] = $T$0$i$i$lcssa;
      HEAP32[$635 + 24 >> 2] = 0;
      break;
     } else _abort();
    }
   }
  } while (0);
  $1053 = HEAP32[46] | 0;
  if ($1053 >>> 0 > $nb$0 >>> 0) {
   $1055 = $1053 - $nb$0 | 0;
   HEAP32[46] = $1055;
   $1056 = HEAP32[49] | 0;
   $1057 = $1056 + $nb$0 | 0;
   HEAP32[49] = $1057;
   HEAP32[$1057 + 4 >> 2] = $1055 | 1;
   HEAP32[$1056 + 4 >> 2] = $nb$0 | 3;
   $$0 = $1056 + 8 | 0;
   return $$0 | 0;
  }
 }
 HEAP32[(___errno_location() | 0) >> 2] = 12;
 $$0 = 0;
 return $$0 | 0;
}

function _free($mem) {
 $mem = $mem | 0;
 var $$lcssa = 0, $$pre$phi41Z2D = 0, $$pre$phi43Z2D = 0, $$pre$phiZ2D = 0, $1 = 0, $104 = 0, $105 = 0, $113 = 0, $114 = 0, $12 = 0, $122 = 0, $130 = 0, $135 = 0, $136 = 0, $139 = 0, $141 = 0, $143 = 0, $15 = 0, $158 = 0, $16 = 0, $163 = 0, $165 = 0, $168 = 0, $171 = 0, $174 = 0, $177 = 0, $178 = 0, $179 = 0, $181 = 0, $183 = 0, $184 = 0, $186 = 0, $187 = 0, $193 = 0, $194 = 0, $2 = 0, $20 = 0, $203 = 0, $208 = 0, $211 = 0, $212 = 0, $218 = 0, $23 = 0, $233 = 0, $236 = 0, $237 = 0, $238 = 0, $242 = 0, $243 = 0, $249 = 0, $25 = 0, $254 = 0, $255 = 0, $258 = 0, $260 = 0, $263 = 0, $268 = 0, $27 = 0, $274 = 0, $278 = 0, $279 = 0, $297 = 0, $299 = 0, $306 = 0, $307 = 0, $308 = 0, $316 = 0, $40 = 0, $45 = 0, $47 = 0, $5 = 0, $50 = 0, $52 = 0, $55 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $62 = 0, $64 = 0, $65 = 0, $67 = 0, $68 = 0, $73 = 0, $74 = 0, $8 = 0, $83 = 0, $88 = 0, $9 = 0, $91 = 0, $92 = 0, $98 = 0, $F18$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R8$1 = 0, $R8$1$lcssa = 0, $R8$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP10$1 = 0, $RP10$1$lcssa = 0, $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa48 = 0, $p$1 = 0, $psize$1 = 0, $psize$2 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0;
 if (!$mem) return;
 $1 = $mem + -8 | 0;
 $2 = HEAP32[47] | 0;
 if ($1 >>> 0 < $2 >>> 0) _abort();
 $5 = HEAP32[$mem + -4 >> 2] | 0;
 $6 = $5 & 3;
 if (($6 | 0) == 1) _abort();
 $8 = $5 & -8;
 $9 = $1 + $8 | 0;
 do if (!($5 & 1)) {
  $12 = HEAP32[$1 >> 2] | 0;
  if (!$6) return;
  $15 = $1 + (0 - $12) | 0;
  $16 = $12 + $8 | 0;
  if ($15 >>> 0 < $2 >>> 0) _abort();
  if (($15 | 0) == (HEAP32[48] | 0)) {
   $104 = $9 + 4 | 0;
   $105 = HEAP32[$104 >> 2] | 0;
   if (($105 & 3 | 0) != 3) {
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
   HEAP32[45] = $16;
   HEAP32[$104 >> 2] = $105 & -2;
   HEAP32[$15 + 4 >> 2] = $16 | 1;
   HEAP32[$15 + $16 >> 2] = $16;
   return;
  }
  $20 = $12 >>> 3;
  if ($12 >>> 0 < 256) {
   $23 = HEAP32[$15 + 8 >> 2] | 0;
   $25 = HEAP32[$15 + 12 >> 2] | 0;
   $27 = 212 + ($20 << 1 << 2) | 0;
   if (($23 | 0) != ($27 | 0)) {
    if ($23 >>> 0 < $2 >>> 0) _abort();
    if ((HEAP32[$23 + 12 >> 2] | 0) != ($15 | 0)) _abort();
   }
   if (($25 | 0) == ($23 | 0)) {
    HEAP32[43] = HEAP32[43] & ~(1 << $20);
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
   if (($25 | 0) == ($27 | 0)) $$pre$phi43Z2D = $25 + 8 | 0; else {
    if ($25 >>> 0 < $2 >>> 0) _abort();
    $40 = $25 + 8 | 0;
    if ((HEAP32[$40 >> 2] | 0) == ($15 | 0)) $$pre$phi43Z2D = $40; else _abort();
   }
   HEAP32[$23 + 12 >> 2] = $25;
   HEAP32[$$pre$phi43Z2D >> 2] = $23;
   $p$1 = $15;
   $psize$1 = $16;
   break;
  }
  $45 = HEAP32[$15 + 24 >> 2] | 0;
  $47 = HEAP32[$15 + 12 >> 2] | 0;
  do if (($47 | 0) == ($15 | 0)) {
   $58 = $15 + 16 | 0;
   $59 = $58 + 4 | 0;
   $60 = HEAP32[$59 >> 2] | 0;
   if (!$60) {
    $62 = HEAP32[$58 >> 2] | 0;
    if (!$62) {
     $R$3 = 0;
     break;
    } else {
     $R$1 = $62;
     $RP$1 = $58;
    }
   } else {
    $R$1 = $60;
    $RP$1 = $59;
   }
   while (1) {
    $64 = $R$1 + 20 | 0;
    $65 = HEAP32[$64 >> 2] | 0;
    if ($65 | 0) {
     $R$1 = $65;
     $RP$1 = $64;
     continue;
    }
    $67 = $R$1 + 16 | 0;
    $68 = HEAP32[$67 >> 2] | 0;
    if (!$68) {
     $R$1$lcssa = $R$1;
     $RP$1$lcssa = $RP$1;
     break;
    } else {
     $R$1 = $68;
     $RP$1 = $67;
    }
   }
   if ($RP$1$lcssa >>> 0 < $2 >>> 0) _abort(); else {
    HEAP32[$RP$1$lcssa >> 2] = 0;
    $R$3 = $R$1$lcssa;
    break;
   }
  } else {
   $50 = HEAP32[$15 + 8 >> 2] | 0;
   if ($50 >>> 0 < $2 >>> 0) _abort();
   $52 = $50 + 12 | 0;
   if ((HEAP32[$52 >> 2] | 0) != ($15 | 0)) _abort();
   $55 = $47 + 8 | 0;
   if ((HEAP32[$55 >> 2] | 0) == ($15 | 0)) {
    HEAP32[$52 >> 2] = $47;
    HEAP32[$55 >> 2] = $50;
    $R$3 = $47;
    break;
   } else _abort();
  } while (0);
  if (!$45) {
   $p$1 = $15;
   $psize$1 = $16;
  } else {
   $73 = HEAP32[$15 + 28 >> 2] | 0;
   $74 = 476 + ($73 << 2) | 0;
   if (($15 | 0) == (HEAP32[$74 >> 2] | 0)) {
    HEAP32[$74 >> 2] = $R$3;
    if (!$R$3) {
     HEAP32[44] = HEAP32[44] & ~(1 << $73);
     $p$1 = $15;
     $psize$1 = $16;
     break;
    }
   } else {
    if ($45 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
    $83 = $45 + 16 | 0;
    if ((HEAP32[$83 >> 2] | 0) == ($15 | 0)) HEAP32[$83 >> 2] = $R$3; else HEAP32[$45 + 20 >> 2] = $R$3;
    if (!$R$3) {
     $p$1 = $15;
     $psize$1 = $16;
     break;
    }
   }
   $88 = HEAP32[47] | 0;
   if ($R$3 >>> 0 < $88 >>> 0) _abort();
   HEAP32[$R$3 + 24 >> 2] = $45;
   $91 = $15 + 16 | 0;
   $92 = HEAP32[$91 >> 2] | 0;
   do if ($92 | 0) if ($92 >>> 0 < $88 >>> 0) _abort(); else {
    HEAP32[$R$3 + 16 >> 2] = $92;
    HEAP32[$92 + 24 >> 2] = $R$3;
    break;
   } while (0);
   $98 = HEAP32[$91 + 4 >> 2] | 0;
   if (!$98) {
    $p$1 = $15;
    $psize$1 = $16;
   } else if ($98 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
    HEAP32[$R$3 + 20 >> 2] = $98;
    HEAP32[$98 + 24 >> 2] = $R$3;
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
  }
 } else {
  $p$1 = $1;
  $psize$1 = $8;
 } while (0);
 if ($p$1 >>> 0 >= $9 >>> 0) _abort();
 $113 = $9 + 4 | 0;
 $114 = HEAP32[$113 >> 2] | 0;
 if (!($114 & 1)) _abort();
 if (!($114 & 2)) {
  if (($9 | 0) == (HEAP32[49] | 0)) {
   $122 = (HEAP32[46] | 0) + $psize$1 | 0;
   HEAP32[46] = $122;
   HEAP32[49] = $p$1;
   HEAP32[$p$1 + 4 >> 2] = $122 | 1;
   if (($p$1 | 0) != (HEAP32[48] | 0)) return;
   HEAP32[48] = 0;
   HEAP32[45] = 0;
   return;
  }
  if (($9 | 0) == (HEAP32[48] | 0)) {
   $130 = (HEAP32[45] | 0) + $psize$1 | 0;
   HEAP32[45] = $130;
   HEAP32[48] = $p$1;
   HEAP32[$p$1 + 4 >> 2] = $130 | 1;
   HEAP32[$p$1 + $130 >> 2] = $130;
   return;
  }
  $135 = ($114 & -8) + $psize$1 | 0;
  $136 = $114 >>> 3;
  do if ($114 >>> 0 < 256) {
   $139 = HEAP32[$9 + 8 >> 2] | 0;
   $141 = HEAP32[$9 + 12 >> 2] | 0;
   $143 = 212 + ($136 << 1 << 2) | 0;
   if (($139 | 0) != ($143 | 0)) {
    if ($139 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
    if ((HEAP32[$139 + 12 >> 2] | 0) != ($9 | 0)) _abort();
   }
   if (($141 | 0) == ($139 | 0)) {
    HEAP32[43] = HEAP32[43] & ~(1 << $136);
    break;
   }
   if (($141 | 0) == ($143 | 0)) $$pre$phi41Z2D = $141 + 8 | 0; else {
    if ($141 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
    $158 = $141 + 8 | 0;
    if ((HEAP32[$158 >> 2] | 0) == ($9 | 0)) $$pre$phi41Z2D = $158; else _abort();
   }
   HEAP32[$139 + 12 >> 2] = $141;
   HEAP32[$$pre$phi41Z2D >> 2] = $139;
  } else {
   $163 = HEAP32[$9 + 24 >> 2] | 0;
   $165 = HEAP32[$9 + 12 >> 2] | 0;
   do if (($165 | 0) == ($9 | 0)) {
    $177 = $9 + 16 | 0;
    $178 = $177 + 4 | 0;
    $179 = HEAP32[$178 >> 2] | 0;
    if (!$179) {
     $181 = HEAP32[$177 >> 2] | 0;
     if (!$181) {
      $R8$3 = 0;
      break;
     } else {
      $R8$1 = $181;
      $RP10$1 = $177;
     }
    } else {
     $R8$1 = $179;
     $RP10$1 = $178;
    }
    while (1) {
     $183 = $R8$1 + 20 | 0;
     $184 = HEAP32[$183 >> 2] | 0;
     if ($184 | 0) {
      $R8$1 = $184;
      $RP10$1 = $183;
      continue;
     }
     $186 = $R8$1 + 16 | 0;
     $187 = HEAP32[$186 >> 2] | 0;
     if (!$187) {
      $R8$1$lcssa = $R8$1;
      $RP10$1$lcssa = $RP10$1;
      break;
     } else {
      $R8$1 = $187;
      $RP10$1 = $186;
     }
    }
    if ($RP10$1$lcssa >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
     HEAP32[$RP10$1$lcssa >> 2] = 0;
     $R8$3 = $R8$1$lcssa;
     break;
    }
   } else {
    $168 = HEAP32[$9 + 8 >> 2] | 0;
    if ($168 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
    $171 = $168 + 12 | 0;
    if ((HEAP32[$171 >> 2] | 0) != ($9 | 0)) _abort();
    $174 = $165 + 8 | 0;
    if ((HEAP32[$174 >> 2] | 0) == ($9 | 0)) {
     HEAP32[$171 >> 2] = $165;
     HEAP32[$174 >> 2] = $168;
     $R8$3 = $165;
     break;
    } else _abort();
   } while (0);
   if ($163 | 0) {
    $193 = HEAP32[$9 + 28 >> 2] | 0;
    $194 = 476 + ($193 << 2) | 0;
    if (($9 | 0) == (HEAP32[$194 >> 2] | 0)) {
     HEAP32[$194 >> 2] = $R8$3;
     if (!$R8$3) {
      HEAP32[44] = HEAP32[44] & ~(1 << $193);
      break;
     }
    } else {
     if ($163 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort();
     $203 = $163 + 16 | 0;
     if ((HEAP32[$203 >> 2] | 0) == ($9 | 0)) HEAP32[$203 >> 2] = $R8$3; else HEAP32[$163 + 20 >> 2] = $R8$3;
     if (!$R8$3) break;
    }
    $208 = HEAP32[47] | 0;
    if ($R8$3 >>> 0 < $208 >>> 0) _abort();
    HEAP32[$R8$3 + 24 >> 2] = $163;
    $211 = $9 + 16 | 0;
    $212 = HEAP32[$211 >> 2] | 0;
    do if ($212 | 0) if ($212 >>> 0 < $208 >>> 0) _abort(); else {
     HEAP32[$R8$3 + 16 >> 2] = $212;
     HEAP32[$212 + 24 >> 2] = $R8$3;
     break;
    } while (0);
    $218 = HEAP32[$211 + 4 >> 2] | 0;
    if ($218 | 0) if ($218 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
     HEAP32[$R8$3 + 20 >> 2] = $218;
     HEAP32[$218 + 24 >> 2] = $R8$3;
     break;
    }
   }
  } while (0);
  HEAP32[$p$1 + 4 >> 2] = $135 | 1;
  HEAP32[$p$1 + $135 >> 2] = $135;
  if (($p$1 | 0) == (HEAP32[48] | 0)) {
   HEAP32[45] = $135;
   return;
  } else $psize$2 = $135;
 } else {
  HEAP32[$113 >> 2] = $114 & -2;
  HEAP32[$p$1 + 4 >> 2] = $psize$1 | 1;
  HEAP32[$p$1 + $psize$1 >> 2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $233 = $psize$2 >>> 3;
 if ($psize$2 >>> 0 < 256) {
  $236 = 212 + ($233 << 1 << 2) | 0;
  $237 = HEAP32[43] | 0;
  $238 = 1 << $233;
  if (!($237 & $238)) {
   HEAP32[43] = $237 | $238;
   $$pre$phiZ2D = $236 + 8 | 0;
   $F18$0 = $236;
  } else {
   $242 = $236 + 8 | 0;
   $243 = HEAP32[$242 >> 2] | 0;
   if ($243 >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
    $$pre$phiZ2D = $242;
    $F18$0 = $243;
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $p$1;
  HEAP32[$F18$0 + 12 >> 2] = $p$1;
  HEAP32[$p$1 + 8 >> 2] = $F18$0;
  HEAP32[$p$1 + 12 >> 2] = $236;
  return;
 }
 $249 = $psize$2 >>> 8;
 if (!$249) $I20$0 = 0; else if ($psize$2 >>> 0 > 16777215) $I20$0 = 31; else {
  $254 = ($249 + 1048320 | 0) >>> 16 & 8;
  $255 = $249 << $254;
  $258 = ($255 + 520192 | 0) >>> 16 & 4;
  $260 = $255 << $258;
  $263 = ($260 + 245760 | 0) >>> 16 & 2;
  $268 = 14 - ($258 | $254 | $263) + ($260 << $263 >>> 15) | 0;
  $I20$0 = $psize$2 >>> ($268 + 7 | 0) & 1 | $268 << 1;
 }
 $274 = 476 + ($I20$0 << 2) | 0;
 HEAP32[$p$1 + 28 >> 2] = $I20$0;
 HEAP32[$p$1 + 20 >> 2] = 0;
 HEAP32[$p$1 + 16 >> 2] = 0;
 $278 = HEAP32[44] | 0;
 $279 = 1 << $I20$0;
 do if (!($278 & $279)) {
  HEAP32[44] = $278 | $279;
  HEAP32[$274 >> 2] = $p$1;
  HEAP32[$p$1 + 24 >> 2] = $274;
  HEAP32[$p$1 + 12 >> 2] = $p$1;
  HEAP32[$p$1 + 8 >> 2] = $p$1;
 } else {
  $K21$0 = $psize$2 << (($I20$0 | 0) == 31 ? 0 : 25 - ($I20$0 >>> 1) | 0);
  $T$0 = HEAP32[$274 >> 2] | 0;
  while (1) {
   if ((HEAP32[$T$0 + 4 >> 2] & -8 | 0) == ($psize$2 | 0)) {
    $T$0$lcssa = $T$0;
    label = 130;
    break;
   }
   $297 = $T$0 + 16 + ($K21$0 >>> 31 << 2) | 0;
   $299 = HEAP32[$297 >> 2] | 0;
   if (!$299) {
    $$lcssa = $297;
    $T$0$lcssa48 = $T$0;
    label = 127;
    break;
   } else {
    $K21$0 = $K21$0 << 1;
    $T$0 = $299;
   }
  }
  if ((label | 0) == 127) if ($$lcssa >>> 0 < (HEAP32[47] | 0) >>> 0) _abort(); else {
   HEAP32[$$lcssa >> 2] = $p$1;
   HEAP32[$p$1 + 24 >> 2] = $T$0$lcssa48;
   HEAP32[$p$1 + 12 >> 2] = $p$1;
   HEAP32[$p$1 + 8 >> 2] = $p$1;
   break;
  } else if ((label | 0) == 130) {
   $306 = $T$0$lcssa + 8 | 0;
   $307 = HEAP32[$306 >> 2] | 0;
   $308 = HEAP32[47] | 0;
   if ($307 >>> 0 >= $308 >>> 0 & $T$0$lcssa >>> 0 >= $308 >>> 0) {
    HEAP32[$307 + 12 >> 2] = $p$1;
    HEAP32[$306 >> 2] = $p$1;
    HEAP32[$p$1 + 8 >> 2] = $307;
    HEAP32[$p$1 + 12 >> 2] = $T$0$lcssa;
    HEAP32[$p$1 + 24 >> 2] = 0;
    break;
   } else _abort();
  }
 } while (0);
 $316 = (HEAP32[51] | 0) + -1 | 0;
 HEAP32[51] = $316;
 if (!$316) $sp$0$in$i = 628; else return;
 while (1) {
  $sp$0$i = HEAP32[$sp$0$in$i >> 2] | 0;
  if (!$sp$0$i) break; else $sp$0$in$i = $sp$0$i + 8 | 0;
 }
 HEAP32[51] = -1;
 return;
}

function ___stdio_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $15 = 0, $20 = 0, $25 = 0, $3 = 0, $34 = 0, $36 = 0, $38 = 0, $49 = 0, $5 = 0, $9 = 0, $cnt$0 = 0, $cnt$1 = 0, $iov$0 = 0, $iov$0$lcssa11 = 0, $iov$1 = 0, $iovcnt$0 = 0, $iovcnt$0$lcssa12 = 0, $iovcnt$1 = 0, $iovs = 0, $rem$0 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $vararg_buffer3 = sp + 16 | 0;
 $vararg_buffer = sp;
 $iovs = sp + 32 | 0;
 $0 = $f + 28 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 HEAP32[$iovs >> 2] = $1;
 $3 = $f + 20 | 0;
 $5 = (HEAP32[$3 >> 2] | 0) - $1 | 0;
 HEAP32[$iovs + 4 >> 2] = $5;
 HEAP32[$iovs + 8 >> 2] = $buf;
 HEAP32[$iovs + 12 >> 2] = $len;
 $9 = $f + 60 | 0;
 $10 = $f + 44 | 0;
 $iov$0 = $iovs;
 $iovcnt$0 = 2;
 $rem$0 = $5 + $len | 0;
 while (1) {
  if (!(HEAP32[31] | 0)) {
   HEAP32[$vararg_buffer3 >> 2] = HEAP32[$9 >> 2];
   HEAP32[$vararg_buffer3 + 4 >> 2] = $iov$0;
   HEAP32[$vararg_buffer3 + 8 >> 2] = $iovcnt$0;
   $cnt$0 = ___syscall_ret(___syscall146(146, $vararg_buffer3 | 0) | 0) | 0;
  } else {
   _pthread_cleanup_push(1, $f | 0);
   HEAP32[$vararg_buffer >> 2] = HEAP32[$9 >> 2];
   HEAP32[$vararg_buffer + 4 >> 2] = $iov$0;
   HEAP32[$vararg_buffer + 8 >> 2] = $iovcnt$0;
   $15 = ___syscall_ret(___syscall146(146, $vararg_buffer | 0) | 0) | 0;
   _pthread_cleanup_pop(0);
   $cnt$0 = $15;
  }
  if (($rem$0 | 0) == ($cnt$0 | 0)) {
   label = 6;
   break;
  }
  if (($cnt$0 | 0) < 0) {
   $iov$0$lcssa11 = $iov$0;
   $iovcnt$0$lcssa12 = $iovcnt$0;
   label = 8;
   break;
  }
  $34 = $rem$0 - $cnt$0 | 0;
  $36 = HEAP32[$iov$0 + 4 >> 2] | 0;
  if ($cnt$0 >>> 0 > $36 >>> 0) {
   $38 = HEAP32[$10 >> 2] | 0;
   HEAP32[$0 >> 2] = $38;
   HEAP32[$3 >> 2] = $38;
   $49 = HEAP32[$iov$0 + 12 >> 2] | 0;
   $cnt$1 = $cnt$0 - $36 | 0;
   $iov$1 = $iov$0 + 8 | 0;
   $iovcnt$1 = $iovcnt$0 + -1 | 0;
  } else if (($iovcnt$0 | 0) == 2) {
   HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + $cnt$0;
   $49 = $36;
   $cnt$1 = $cnt$0;
   $iov$1 = $iov$0;
   $iovcnt$1 = 2;
  } else {
   $49 = $36;
   $cnt$1 = $cnt$0;
   $iov$1 = $iov$0;
   $iovcnt$1 = $iovcnt$0;
  }
  HEAP32[$iov$1 >> 2] = (HEAP32[$iov$1 >> 2] | 0) + $cnt$1;
  HEAP32[$iov$1 + 4 >> 2] = $49 - $cnt$1;
  $iov$0 = $iov$1;
  $iovcnt$0 = $iovcnt$1;
  $rem$0 = $34;
 }
 if ((label | 0) == 6) {
  $20 = HEAP32[$10 >> 2] | 0;
  HEAP32[$f + 16 >> 2] = $20 + (HEAP32[$f + 48 >> 2] | 0);
  $25 = $20;
  HEAP32[$0 >> 2] = $25;
  HEAP32[$3 >> 2] = $25;
  $$0 = $len;
 } else if ((label | 0) == 8) {
  HEAP32[$f + 16 >> 2] = 0;
  HEAP32[$0 >> 2] = 0;
  HEAP32[$3 >> 2] = 0;
  HEAP32[$f >> 2] = HEAP32[$f >> 2] | 32;
  if (($iovcnt$0$lcssa12 | 0) == 2) $$0 = 0; else $$0 = $len - (HEAP32[$iov$0$lcssa11 + 4 >> 2] | 0) | 0;
 }
 STACKTOP = sp;
 return $$0 | 0;
}

function _fflush($f) {
 $f = $f | 0;
 var $$0 = 0, $$012 = 0, $$014 = 0, $23 = 0, $27 = 0, $6 = 0, $phitmp = 0, $r$0$lcssa = 0, $r$03 = 0, $r$1 = 0;
 do if (!$f) {
  if (!(HEAP32[30] | 0)) $27 = 0; else $27 = _fflush(HEAP32[30] | 0) | 0;
  ___lock(152);
  $$012 = HEAP32[37] | 0;
  if (!$$012) $r$0$lcssa = $27; else {
   $$014 = $$012;
   $r$03 = $27;
   while (1) {
    if ((HEAP32[$$014 + 76 >> 2] | 0) > -1) $23 = ___lockfile($$014) | 0; else $23 = 0;
    if ((HEAP32[$$014 + 20 >> 2] | 0) >>> 0 > (HEAP32[$$014 + 28 >> 2] | 0) >>> 0) $r$1 = ___fflush_unlocked($$014) | 0 | $r$03; else $r$1 = $r$03;
    if ($23 | 0) ___unlockfile($$014);
    $$014 = HEAP32[$$014 + 56 >> 2] | 0;
    if (!$$014) {
     $r$0$lcssa = $r$1;
     break;
    } else $r$03 = $r$1;
   }
  }
  ___unlock(152);
  $$0 = $r$0$lcssa;
 } else {
  if ((HEAP32[$f + 76 >> 2] | 0) <= -1) {
   $$0 = ___fflush_unlocked($f) | 0;
   break;
  }
  $phitmp = (___lockfile($f) | 0) == 0;
  $6 = ___fflush_unlocked($f) | 0;
  if ($phitmp) $$0 = $6; else {
   ___unlockfile($f);
   $$0 = $6;
  }
 } while (0);
 return $$0 | 0;
}

function ___fflush_unlocked($f) {
 $f = $f | 0;
 var $$0 = 0, $0 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $9 = 0, label = 0;
 $0 = $f + 20 | 0;
 $2 = $f + 28 | 0;
 if ((HEAP32[$0 >> 2] | 0) >>> 0 > (HEAP32[$2 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 3]($f, 0, 0) | 0;
  if (!(HEAP32[$0 >> 2] | 0)) $$0 = -1; else label = 3;
 } else label = 3;
 if ((label | 0) == 3) {
  $9 = $f + 4 | 0;
  $10 = HEAP32[$9 >> 2] | 0;
  $11 = $f + 8 | 0;
  $12 = HEAP32[$11 >> 2] | 0;
  if ($10 >>> 0 < $12 >>> 0) FUNCTION_TABLE_iiii[HEAP32[$f + 40 >> 2] & 3]($f, $10 - $12 | 0, 1) | 0;
  HEAP32[$f + 16 >> 2] = 0;
  HEAP32[$2 >> 2] = 0;
  HEAP32[$0 >> 2] = 0;
  HEAP32[$11 >> 2] = 0;
  HEAP32[$9 >> 2] = 0;
  $$0 = 0;
 }
 return $$0 | 0;
}

function runPostSets() {}
function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
 stop = ptr + num | 0;
 if ((num | 0) >= 20) {
  value = value & 255;
  unaligned = ptr & 3;
  value4 = value | value << 8 | value << 16 | value << 24;
  stop4 = stop & ~3;
  if (unaligned) {
   unaligned = ptr + 4 - unaligned | 0;
   while ((ptr | 0) < (unaligned | 0)) {
    HEAP8[ptr >> 0] = value;
    ptr = ptr + 1 | 0;
   }
  }
  while ((ptr | 0) < (stop4 | 0)) {
   HEAP32[ptr >> 2] = value4;
   ptr = ptr + 4 | 0;
  }
 }
 while ((ptr | 0) < (stop | 0)) {
  HEAP8[ptr >> 0] = value;
  ptr = ptr + 1 | 0;
 }
 return ptr - num | 0;
}

function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((num | 0) >= 4096) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0;
 ret = dest | 0;
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if (!num) return ret | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   dest = dest + 1 | 0;
   src = src + 1 | 0;
   num = num - 1 | 0;
  }
  while ((num | 0) >= 4) {
   HEAP32[dest >> 2] = HEAP32[src >> 2];
   dest = dest + 4 | 0;
   src = src + 4 | 0;
   num = num - 4 | 0;
  }
 }
 while ((num | 0) > 0) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  dest = dest + 1 | 0;
  src = src + 1 | 0;
  num = num - 1 | 0;
 }
 return ret | 0;
}

function ___stdio_seek($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 var $5 = 0, $ret = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $vararg_buffer = sp;
 $ret = sp + 20 | 0;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
 HEAP32[$vararg_buffer + 4 >> 2] = 0;
 HEAP32[$vararg_buffer + 8 >> 2] = $off;
 HEAP32[$vararg_buffer + 12 >> 2] = $ret;
 HEAP32[$vararg_buffer + 16 >> 2] = $whence;
 if ((___syscall_ret(___syscall140(140, $vararg_buffer | 0) | 0) | 0) < 0) {
  HEAP32[$ret >> 2] = -1;
  $5 = -1;
 } else $5 = HEAP32[$ret >> 2] | 0;
 STACKTOP = sp;
 return $5 | 0;
}

function ___stdout_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $9 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80 | 0;
 $vararg_buffer = sp;
 HEAP32[$f + 36 >> 2] = 3;
 if (!(HEAP32[$f >> 2] & 64)) {
  HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
  HEAP32[$vararg_buffer + 4 >> 2] = 21505;
  HEAP32[$vararg_buffer + 8 >> 2] = sp + 12;
  if (___syscall54(54, $vararg_buffer | 0) | 0) HEAP8[$f + 75 >> 0] = -1;
 }
 $9 = ___stdio_write($f, $buf, $len) | 0;
 STACKTOP = sp;
 return $9 | 0;
}

function copyTempDouble(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0];
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0];
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0];
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0];
 HEAP8[tempDoublePtr + 4 >> 0] = HEAP8[ptr + 4 >> 0];
 HEAP8[tempDoublePtr + 5 >> 0] = HEAP8[ptr + 5 >> 0];
 HEAP8[tempDoublePtr + 6 >> 0] = HEAP8[ptr + 6 >> 0];
 HEAP8[tempDoublePtr + 7 >> 0] = HEAP8[ptr + 7 >> 0];
}

function ___stdio_close($f) {
 $f = $f | 0;
 var $3 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $vararg_buffer = sp;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
 $3 = ___syscall_ret(___syscall6(6, $vararg_buffer | 0) | 0) | 0;
 STACKTOP = sp;
 return $3 | 0;
}

function copyTempFloat(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0];
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0];
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0];
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0];
}

function ___syscall_ret($r) {
 $r = $r | 0;
 var $$0 = 0;
 if ($r >>> 0 > 4294963200) {
  HEAP32[(___errno_location() | 0) >> 2] = 0 - $r;
  $$0 = -1;
 } else $$0 = $r;
 return $$0 | 0;
}

function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 3](a1 | 0, a2 | 0, a3 | 0) | 0;
}
function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP;
 STACKTOP = STACKTOP + size | 0;
 STACKTOP = STACKTOP + 15 & -16;
 return ret | 0;
}

function ___errno_location() {
 var $$0 = 0;
 if (!(HEAP32[31] | 0)) $$0 = 168; else $$0 = HEAP32[(_pthread_self() | 0) + 64 >> 2] | 0;
 return $$0 | 0;
}

function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0;
 stackMax = stackMax | 0;
 STACKTOP = stackBase;
 STACK_MAX = stackMax;
}

function setThrew(threw, value) {
 threw = threw | 0;
 value = value | 0;
 if (!__THREW__) {
  __THREW__ = threw;
  threwValue = value;
 }
}

function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 1](a1 | 0) | 0;
}

function dynCall_vi(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 FUNCTION_TABLE_vi[index & 1](a1 | 0);
}

function _cleanup($p) {
 $p = $p | 0;
 if (!(HEAP32[$p + 68 >> 2] | 0)) ___unlockfile($p);
 return;
}

function b1(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(1);
 return 0;
}

function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value;
}

function stackRestore(top) {
 top = top | 0;
 STACKTOP = top;
}

function b0(p0) {
 p0 = p0 | 0;
 abort(0);
 return 0;
}

function ___unlockfile($f) {
 $f = $f | 0;
 return;
}

function ___lockfile($f) {
 $f = $f | 0;
 return 0;
}

function getTempRet0() {
 return tempRet0 | 0;
}

function stackSave() {
 return STACKTOP | 0;
}

function b2(p0) {
 p0 = p0 | 0;
 abort(2);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,___stdout_write,___stdio_seek,___stdio_write];
var FUNCTION_TABLE_vi = [b2,_cleanup];

  return { _free: _free, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, _fflush: _fflush, ___errno_location: ___errno_location, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var _fflush = Module["_fflush"] = asm["_fflush"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _free = Module["_free"] = asm["_free"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===



if (memoryInitializer) {
  if (typeof Module['locateFile'] === 'function') {
    memoryInitializer = Module['locateFile'](memoryInitializer);
  } else if (Module['memoryInitializerPrefixURL']) {
    memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, Runtime.GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      HEAPU8.set(data, Runtime.GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        if (request.status !== 200 && request.status !== 0) {
          // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
          // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
          // Look in your browser's devtools network console to see what's going on.
          console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
          doBrowserLoad();
          return;
        }
        applyMemoryInitializer(request.response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}

function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}






