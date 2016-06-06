/*global $, DeepDiff */
/*jshint unused:false*/

/*
 * TODO: convert convertHostListFromNagios4 into a shared with convertServiceListFromNagios4
 */
import Ember from 'ember';

export default Ember.Service.extend({

  serverBaseUrl: 'http://10.69.1.58:3000/nagios/',

  timerIntervalSeconds: 15,
  timerHandle: null,

  hostlist: {},
  servicelist: {},
  notificationlist: [],

  dateLastUpdate: null,

  /***************************************************************************
   * Computed Properties
   ***************************************************************************/

   servicelistCount: Ember.computed('servicelist', function() {
    let count = 0;
    let servicelist = this.get('servicelist');
    for (let host in servicelist) {
      /* jshint ignore:start */
      for (let service in servicelist[host]) { // jshint ignore:line
        count++;
      }
      /* jshint ignore:end */
    }
    return count;
  }),

  servicelistDownCount: Ember.computed('servicelist', function() {
    let count = 0;
    let servicelist = this.get('servicelist');
    for (let host in servicelist) {
      for (let service in servicelist[host]) {
        if (servicelist[host][service].status !== 2) { count++; }
      }
    }
    return count;
  }),

  hostlistDownCount: Ember.computed('hostlist.length', function() {
    let count = 0;
    let hostlist = this.get('hostlist');
    for (let host in hostlist) {
      if (hostlist[host].status !== 2) { count++; }
    }
    return count;
  }),

  /***************************************************************************
   * Functions (public)
   ***************************************************************************/

  startTimer: function() {
    const that = this;
    const timerIntervalSeconds = this.get('timerIntervalSeconds');
    const timerHandle = setInterval(function() {
      that.fetchUpdate();
    }, timerIntervalSeconds * 1000);
    this.set('timerHandle', timerHandle);
  },

  stopTimer: function() {
    clearInterval(this.get('timerHandle'));
  },

  fetchUpdate: function() {
    this.fetchUpdateFromNagios4();
  },

  /***************************************************************************
   * Functions (private)
   ***************************************************************************/

  fetchUpdateFromNagios4: function() {

    var that = this;

    //console.log('fetchUpdateFromNagios4() ' + new Date());

    // direct to Nagios after I fix CORS on it
    //var baseUrl = 'http://10.69.1.52/nagios/cgi-bin/';

    // Proxy through node server in node/ folder
    //var baseUrl = 'http://localhost:3000/nagios/';

    var baseUrl = this.get('serverBaseUrl');

    $.getJSON(baseUrl+'statusjson.cgi?query=hostlist&details=true').then(function(data) {
      // perform diff and set the data
      that.diffFromNagios4('hostlist', data);
    });

    $.getJSON(baseUrl+'statusjson.cgi?query=servicelist&details=true').then(function(data) {
      // perform diff and set the data
      that.diffFromNagios4('servicelist', data);

      // set last update date for display to the screen and use in various triggers
      that.set('dateLastUpdate', new Date());
    });

    // TODO: move this onto it's own timer
    var starttime = '-1000000';

    $.getJSON(baseUrl+'archivejson.cgi?query=notificationlist&starttime='+starttime+'&endtime=%2B0').then(function(data) {
      // sort the list newest first
      data.data.notificationlist = data.data.notificationlist.sort(function(o1, o2) {
        if (o1.timestamp < o2.timestamp) { return 1; }
        else if(o1.timestamp > o2.timestamp) { return  -1; }
        else { return  0; }
      });

      // perform diff and set the data
      that.diffFromNagios4('notificationlist', data);
    });

  }, // fetchUpdateFromNagios4()

  diffFromNagios4: function(obj_name, obj_raw_data) {
    let the_object = this.get(obj_name);
    const differences = DeepDiff.diff(the_object, obj_raw_data.data[obj_name]);

    this.propertyWillChange(obj_name);

    if (differences) {
      differences.forEach(function(d) {

        //console.log('d is', d);

        switch(d.kind) {
          case 'A':
            //Ember.set(the_object, obj_raw_data.data[obj_name]);
            //the_right_object = obj_raw_data.data[obj_name];
            if (d.item.kind === 'N') {
              the_object.pushObject(d.item.rhs);
            } else if (d.item.kind === 'D') {
              the_object.removeAt(d.index);
            } else {
              console.log('A unknown d', d);
            }
            break;
          case 'N':
            if (d.path) {
    //console.log('N ', the_object, d.path[0], obj_raw_data.data[obj_name][d.path[0]]);
    //console.log('N', the_object instanceof Array);

              if (the_object instanceof Array) {
                Ember.set(the_object, d.path[0].toString(), obj_raw_data.data[obj_name][d.path[0]]);
              }else {
                Ember.set(the_object, d.path[0], obj_raw_data.data[obj_name][d.path[0]]);
              }



            } else {
              console.log('N unknown d', d);
            }
            break;
          case 'E':
            //console.log('d is', d);
            //console.log('obj_raw is ', obj_raw_data.data[obj_name]);
            //console.log('d.path is', d.path);
            //console.log();
            if (d.path) {
    //console.log('E ', the_object, d.path[0], obj_raw_data.data[obj_name][d.path[0]]);
    //console.log('E', the_object instanceof Array);
              if (the_object instanceof Array) {
                Ember.set(the_object[d.path[0]], d.path[1].toString(), obj_raw_data.data[obj_name][d.path[0]][d.path[1]]);
              } else {
                Ember.set(the_object[d.path[0]], d.path[1], obj_raw_data.data[obj_name][d.path[0]][d.path[1]]);
              }

            } else {
              console.log('E unknown d', d);
            }

            break;
          case 'D':
            delete the_object[d.path[0]][d.path[1]];
            break;
          default:
            console.log('unknown d', d);
            break;
        }
      });
    }

    this.propertyDidChange(obj_name);
  }

});
