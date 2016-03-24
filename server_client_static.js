var connect = require('connect');
var serveStatic = require('serve-static');
var path = require('path');

// build

connect().use(serveStatic(  path.join( __dirname, 'build' )  )).listen(8085, function()
{
    console.log('Server running on 8085...');
});