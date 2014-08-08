/*global Backbone,define*/

;(function (root, factory) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['backbone','marionette','jquery','underscore'], factory);
  } else {
    // Browser globals
    root.Marionette.FormView = factory(root.Backbone,root.Marionette,root.jQuery,root._);
  }
}(this, function (Backbone,Marionette,$,_) {
  "use strict";

  /**
   * FormView Extension of Backbone.Marionette.ItemView
   *
   * @param {Object} options                   Options defining this FormView
   * @param {Object} [options.data]            Form Data. (Required if options.model is not set)
   * @param {Object} [options.fields]          Which Fields to include
   *
   */
  var FormView = Marionette.FormView = Marionette.ItemView.extend({

    className : "formView",

    rules   : {}, //Custom Field Validation Rules

    fields  : {},

    initialize : function(options){
      options = options || {} ;

      //Allow Passing In Fields by extending with a fields hash
      if (!this.fields) throw new Error("Fields Must Be Provided");

        // set up model
      this.model = options.model || this.model;
      if (!this.model) {
          this.model = new Backbone.Model();
      }
      this.listenTo(this.model, 'change', this.changeFieldVal,this);

        // set up data
      this.data = options.data || this.data;
      if (this.data) this.model.set(this.data);

      //Attach Events to preexisting elements if we don't have a template
      this.template = options.template || this.template;
      if (!this.template) {
          this.runInitializers();
      }
      this.on('item:rendered',this.runInitializers, this);
      this.on('render',this.runInitializers, this);
    },
    changeFieldVal : function(model, fields) {
      if(!_.isEmpty(fields) && fields.changes) {
        var modelProperty = Object.keys(fields.changes);
        this.inputVal(modelProperty, this.model.get(modelProperty));
      } else if (fields.unset) {
        _(this.fields).each(function(options, field) {
          var elem = this.$('[data-field="'+field+'"]');
          this.inputVal(elem, this.model.get(field));
        },this);
      }
    },

    populateFields : function () {
      _(this.fields).each(function(options, field) {
        var elem = this.$('[data-field="'+field+'"]');
        this.inputVal(elem, this.model.get(field));
        if (options.autoFocus) elem.focus();
      },this);
    },

    serializeFormData : function () {
      var data = {}, self = this;

      _(this.fields).each(function(options, field){
        data[field] = self.inputVal(field);
      });

      return data;
    },

    beforeFormSubmit : function (e) {
      var errors = this.validate();
      var success = _.isEmpty(errors);
      if (success) {
        if (_.isFunction(this.onSubmit)) return this.onSubmit.apply(this, [e]);
      } else {
        if (_.isFunction(this.onSubmitFail)) this.onSubmitFail.apply(this, [errors]);
        e.stopImmediatePropagation();
        return false;
      }
    },

    onFieldEvent : function(evt) {
      this.handleFieldEvent(evt, evt.type);
    },

    handleFieldEvent : function(evt, eventName) {
      var el = evt.target || evt.srcElement,
        field = $(el).attr('data-field'),
        fieldOptions = this.fields[field],
        isValid = true;

      if (fieldOptions.validateOn ) {
        // validation on
        if ( fieldOptions.validateOn === eventName ) {
          // validate
          var errors = this.validateField(field),
              isValid = _.isEmpty(errors)
          ;
          if (!isValid && _.isFunction(this.onValidationFail)){
              this.onValidationFail(errors);
          }
          if (isValid){
            this.model.set(field, $(el).val());
            if ( _.isFunction(this.onValidationOk) ) {
                this.onValidationOk(field);
            }
          }
        }
      } else {
          // no validation just save
          this.model.set(field, $(el).val());
      }
      return isValid;
    },

    validate : function () {
      var errors = {},
        fields = _(this.fields).keys();

      _(fields).each(function (field) {
        var fieldErrors = this.validateField(field);
        if (!_.isEmpty(fieldErrors)) errors[field] = fieldErrors;
      },this);
      return errors;
    },

    validateField : function(field) {
      var fieldOptions = this.fields[field],
        validations = fieldOptions && fieldOptions.validations ? fieldOptions.validations : {},
        fieldErrors = [],
        allowEmpty = fieldOptions.allowEmpty,
        isValid = true;

      var val = this.inputVal(field);
      if( allowEmpty && val == '' ){
        // ok
      } else {
        if (fieldOptions.required) {
          isValid = this.validateRule(val,'required');
          var errorMessage = typeof fieldOptions.required === 'string' ? fieldOptions.required : 'This field is required';
          if (!isValid) fieldErrors.push(errorMessage);
        }

        // Don't bother with other validations if failed 'required' already
        if (isValid && validations) {
          _.each(validations, function (errorMsg, validateWith) {
            isValid = this.validateRule(val, validateWith);
            if (!isValid) fieldErrors.push(errorMsg);
          },this);
        }

        if (!_.isEmpty(fieldErrors)) {
          var errorObject = {
            field : field,
            el : this.fields[field].el,
            error : fieldErrors
          };
          return errorObject;
        }
      }
    },

    inputVal : function(input, val) {
      //takes field name or jQuery object
      var el = input.jquery ? input : this.$('[data-field="'+input+'"]');
      var self = this, mode = typeof val === 'undefined' ? 'get' : 'set';

      if (el.data('fieldtype') === 'object'){
        if (mode === 'get') val = {};
        el.find('[data-property]').each(function(){
          var elem = $(this);
          var prop = elem.attr('data-property');
          if (mode === 'get'){
            val[prop] = self.inputVal(elem);
          } else if (val){
            self.inputVal(elem, val[prop]);
          }
        });
      } else if (el.data('fieldtype') === 'array'){
        if (mode === 'get') val = [];
        el.find('[data-index]').each(function(){
          var elem = $(this);
          var index = elem.data('index');
          if (mode === 'get'){
            val[index] = self.inputVal(elem);
          } else if (val){
            self.inputVal(elem, val[index]);
          }
        });
      } else if (el.is('input')) {
        var inputType = el.attr('type').toLowerCase();
        switch (inputType) {
          case "radio":
            el.each(function(){
              var radio = $(this);
              if (mode === 'get'){
                if (radio.is(':checked')){
                  val = radio.val();
                  return false;
                }
              } else {
                if (radio.val() === val){
                  radio.prop('checked', true);
                  return false;
                }
              }
            });
            break;
          case "checkbox":
            if (mode === 'get'){
              val = el.is(':checked');
            } else {
              el.prop('checked', !!val);
            }
            break;
          case "password":
            if (mode === 'get'){
              val = el.val();
            } else {
              el.val(val);
            }
            break;
          default :
            if (mode === 'get'){
              val = $.trim(el.val());
            } else {
              el.val(val);
            }
            break;
        }
      } else {
        if (mode === 'get'){
          val = $.trim(el.val());
        } else {
          el.val(val);
        }
        //Handle Select / MultiSelect Etc
        //@todo
      }

      return val;
    },

    validateRule : function (val,validationRule) {
      var options;

      // throw an error because it could be tough to troubleshoot if we just return false
      if (!validationRule) throw new Error('Not passed a validation to test');

      if (validationRule === 'required') return FormValidator.required(val);

      if (validationRule.indexOf(':') !== -1) {
        options = validationRule.split(":");
        validationRule = options.shift();
      }

      if (this.rules && this.rules[validationRule]) {
        return _(this.rules[validationRule]).bind(this)(val);
      } else {
        return _(FormValidator.validate).bind(this)(validationRule, val, options);
      }
      return true;
    },

    submit : function () {
      this.form.submit();
    },

    bindFormEvents : function() {
      var form = (this.$el.is('form')) ? this.$el : this.$('form').first();
      this.form = form;

      this.$('input')
        .blur(_(this.onFieldEvent).bind(this))
        .keyup(_(this.onFieldEvent).bind(this))
        .keydown(_(this.onFieldEvent).bind(this))
        .change(_(this.onFieldEvent).bind(this));

      form.submit(_(this.beforeFormSubmit).bind(this));
    },

    runInitializers : function() {
      this.populateFields();
      this.bindFormEvents();
      if (_.isFunction(this.onReady)) this.onReady();
    }
  });

  var FormValidator = {

    regex : {
      //RFC 2822
      email : /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i,
      alpha : /^[a-zA-Z]+$/,
      alphanum : /^[a-zA-Z0-9]+$/,
      url:  new RegExp(
        "^" +
                // protocol identifier
            "(?:(?:https?|ftp)://)" +
            // user:pass authentication
            "(?:\\S+(?::\\S*)?@)?" +
            "(?:" +
            // IP address exclusion
            // private & local networks
            "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
            "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
            "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
            // IP address dotted notation octets
            // excludes loopback network 0.0.0.0
            // excludes reserved space >= 224.0.0.0
            // excludes network & broacast addresses
            // (first & last IP address of each class)
            "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
            "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
            "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
            "|" +
            // host name
            "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
            // domain name
            "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
            // TLD identifier
            "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
            ")" +
            // port number
            "(?::\\d{2,5})?" +
            // resource path
            "(?:/\\S*)?" +
            "$", "i"
    )
    },

    validate : function(validator, val, options) {
      if (_.isFunction(FormValidator[validator])) return _(FormValidator[validator]).bind(this)(val,options);
      throw new Error('Validator does not exist : ' + validator);
    },

    matches : function(val,field) {
      /*jshint eqeqeq:false*/
      return val == this.inputVal(field);
    },

    min : function(val,minLength) {
      if (val.length < minLength) return false;
      return true;
    },

    max : function(val, maxLength) {
      if (val.length > maxLength) return false;
      return true;
    },

    numeric : function(val) {
      return _.isNumber(val);
    },

    alpha : function(val) {
      return FormValidator.regex.alpha.test(val);
    },

    alphanum : function (val) {
      return FormValidator.regex.alphanum.test(val);
    },

    email : function(val) {
      return FormValidator.regex.email.test(val);
    },

    url : function(val) {
      return FormValidator.regex.url.test(val);
    },

    required : function(val) {
      if (val === false || _.isNull(val) || _.isUndefined(val) ||  (_.isString(val) && val.length === 0)) return false;
      return true;
    },

    boolean : function(val) {
      return _.isBoolean(val);
    }
  };

  return FormView;
}));
