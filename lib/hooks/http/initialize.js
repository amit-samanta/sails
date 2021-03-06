/**
 * Module dependencies.
 */

var _ = require('lodash');

module.exports = function(sails) {

    /**
     * Configure the encapsulated Express server that will be used to serve actual HTTP requests
     */

    return function loadExpress(cb) {

        // In order for an existent and correct `sails.config`
        // to be passed in, these requires should be here,
        // not above:  ||
        //             \/
        var startServer = require('./start')(sails);

        // Provides support for undocumented `express.loadMiddleware` config
        // (should no longer be relevant in most cases thanks to new `http.middleware` conf)
        var installHTTPMiddleware = sails.config.http.loadMiddleware || require('./middleware/load');

        // Required to be here due to dynamic NODE_ENV settings via command line args
        // (i.e. if we `require` this above w/ everything else, the NODE_ENV might not be set properly yet)
        var express = require('express');


        // Create express server
        var app = sails.hooks.http.app = express();
        app.disable('x-powered-by');
        // (required by Express 3.x)
        var usingSSL = sails.config.ssl === true || (sails.config.ssl.key && sails.config.ssl.cert) || sails.config.ssl.pfx;

        // Merge SSL into server options
        var serverOptions = sails.config.http.serverOptions || {};
        _.extend(serverOptions, sails.config.ssl);

        // Get the appropriate server creation method for the protocol
        var createServer = usingSSL ?
            require('https').createServer :
            require('http').createServer;

        // Use serverOptions if they were specified
        // Manually create http server using Express app instance
        if (sails.config.http.serverOptions || usingSSL) {
            sails.hooks.http.server = createServer(serverOptions, sails.hooks.http.app);
        } else sails.hooks.http.server = createServer(sails.hooks.http.app);


        // Configure views if hook enabled
        if (sails.hooks.views) {

            sails.after('hook:views:loaded', function() {
                var View = require('./view');

                // Use View subclass to allow case-insensitive view lookups
                sails.hooks.http.app.set('view', View);

                // Set up location of server-side views and their engine
                sails.hooks.http.app.set('views', sails.config.paths.views);

                // Teach Express how to render templates w/ our configured view extension
                app.engine(sails.config.views.engine.ext, sails.config.views.engine.fn);

                // Set default view engine
                sails.log.verbose('Setting default Express view engine to ' + sails.config.views.engine.ext + '...');
                sails.hooks.http.app.set('view engine', sails.config.views.engine.ext);
            });
        }

        // When Sails binds routes, bind them to the internal Express router
        sails.on('router:bind', function(route) {

            route = _.cloneDeep(route);

            // TODO: Add support for error domains..?

            app[route.verb || 'all'](route.path, route.target);
        });

        // When Sails unbinds routes, remove them from the internal Express router
        sails.on('router:unbind', function(route) {
            var newRoutes = [];
            _.each(app.routes[route.method], function(expressRoute) {
                if (expressRoute.path != route.path) {
                    newRoutes.push(expressRoute);
                }
            });
            app.routes[route.method] = newRoutes;

        });

        // When Sails is ready, start the express server
        sails.on('ready', startServer);

        // app.use() the configured express middleware
        var defaultMiddleware = require('./middleware/defaults')(sails, app);
        installHTTPMiddleware(app, defaultMiddleware, sails);
        
        // Note that it is possible for the configured HTTP middleware stack to be shared with the
        // core router built into Sails-- this would make the same stack take effect for all virtual requests
        // including sockets.  Currently, an abbreviated version of this stack is built-in to `lib/router/`
        // in an imperative way (rather than the declarative approach used here: a sorted array of named middleware).
        //
        // In Sails core, this has been explored in a number of different ways in the past.
        // In the future, it would be possible to add a separate middleware stack configuration for virtual
        // requests (including socket requests).  However, while this would certainly be more consistent, in practice,
        // this would have an unwanted impact on performance.

        return cb();
    };

};
