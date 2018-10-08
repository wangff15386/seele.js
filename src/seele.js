var api  = require('./commands')
 ,  http = require('http')

/**
* seeleWebProvider should be used to send rpc calls over http
*/
var seeleWebProvider = function (host, port, headers, user, password, timeout) {
  this.host = host || 'localhost';
  this.port = port || '8037'
  this.headers = headers;
  this.user = user;
  this.password = password;
  this.timeout = timeout || 0;
};

/**
* Should be called to prepare new ClientRequest
*
* @method prepareRequest
* @param {Boolean} true if request should be async
* @return {ClientRequest} object
*/
seeleWebProvider.prototype.prepareRequest = function (fn, async) {
  var options = {
    host: this.host,
    port: this.port,
    method: "POST",
    timeout: this.timeout
  }

  var request = http.request(options, function(response) {
    var data = ''
    response.setEncoding('utf8')
    response.on('data', function(chunk) {
        data += chunk
    })
    response.on('end', function() {
        try {
            data = JSON.parse(data)
            if (data.error) {
                return fn(new Error(JSON.stringify(data)))
            }

            fn(null, data.result || data)
        }catch(exception) {
            var errMsg = response.statusCode !== 200
                ? 'Invalid params ' + response.statusCode
                : 'Failed to parse JSON'
            errMsg += ' : '+JSON.stringify(data)
            return fn(new Error(errMsg))
        }
    })
  })
  
  // user and password
  if (this.user && this.password) {
    var auth = 'Basic ' + new Buffer(this.user + ':' + this.password).toString('base64');
    request.setHeader('Authorization', auth);
  }

  // headers
  request.setHeader('Content-Type', 'application/json');
  if(this.headers) {
    this.headers.forEach(function(header) {
      request.setHeader(header.name, header.value);
    });
  }
  // req.on('error', fn)
  // req.end(rpcData)

  return request;
};

/**
* Should be called to make sync request
*
* @method send
* @param {Object} command
* @return {Object} result
*/
seeleWebProvider.prototype.send = function (command) {
  var args = Array.prototype.slice.call(arguments, 1)
  ,   fn = console.log

  if (typeof args[args.length-1] === 'function') {
      fn = args.pop().bind(this)
  }

  var request = this.prepareRequest(fn, false)

  var rpcData = JSON.stringify({
    id:      new Date().getTime()
    ,  method:  "seele_".concat(command)
    ,  params:  args
  })

  request.on('error', fn);
  request.end(rpcData);
  return this;
};


seeleWebProvider.prototype.invalid = function(command) {
  var args = Array.prototype.slice.call(arguments, 1);

  return console.log(new Error('No such command "' + command  + '"'));
};

seeleWebProvider.prototype.exec = function(command) {
  var func = api.isCommand(command) ? 'send' : 'invalid'
  return this[func].apply(this, arguments)
},

api.commands.forEach(function(command) {
  var cp = seeleWebProvider.prototype
  cp[command] = function() {
    this.send(command, ...arguments);
  };
})

module.exports = seeleWebProvider;