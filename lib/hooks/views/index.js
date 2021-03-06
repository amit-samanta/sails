/**
 * Module dependencies
 */

var _ = require('lodash');
var configure = require('./configure');
var defaults = require('./defaults');
var onRoute = require('./onRoute');
var addLayoutShim = require('./layoutshim');
var addResViewMethod = require('./res.view');
var render = require('./render');
var implicitActions = require('./actions');





module.exports = function (sails) {

  /**
   * `views` hook
   */
  return {

    defaults: defaults,

    configure: _.partial(configure, sails),

    render: render,

    /**
     * Standard responsibilities of `initialize` are to load middleware methods
     * and listen for events to know when to bind any special routes.
     *
     * @api private
     */
    initialize: function (cb) {

      if (!sails.hooks.http) {
        var err = new Error('`views` hook requires the `http` hook, but the `http` hook is disabled.  Please enable both or neither.');
        err.message = '`views` hook requires the `http` hook, but the `http` hook is disabled.  Please enable both or neither.';
        err.type = err.code = 'E_HOOKINIT_DEP';
        err.name = 'failed requires `http` hook';
        err.status = 400;
        return cb(err);
      }

      // Before handing off incoming requests, bind handler that adds the `res.view()` method to `res`.
      // (flagging middleware along the way)
      addResViewMethod._middlewareType = 'VIEWS HOOK: addResViewMethod';
      sails.on('router:before', function () {

        // But wait until after internationalization has happened
        // (if applicable)
        if (sails.hooks.i18n) {
          sails.after('hook:i18n:loaded', function () {
            sails.router.bind('/*', addResViewMethod, 'all', { });
          });
        }
        else {
          sails.router.bind('/*', addResViewMethod, 'all');
        }
      });

      // Register `{view:'/foo'}` route target syntax.
      sails.on('route:typeUnknown', _.partial(onRoute, sails));

      // Declare hook loaded when ejs layouts have been applied,
      // views have been inventoried, and view-serving middleware has been prepared
      addLayoutShim(sails);

      // Detect and prepare implicit actions
      // for each view file so they can be routed to
      // using {view:'...'} syntax in `routes.js`
      implicitActions(sails, this);

      // Expose `sails.renderView()` function to userland.
      sails.renderView = this.render;

      return cb();
    }
  };
};
