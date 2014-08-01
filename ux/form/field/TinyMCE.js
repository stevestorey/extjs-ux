/**
 * @class Ext.ux.form.field.TinyMCE
 * @extends Ext.form.field.TextArea
 *
 * The Initial Developer of the Original Code is daanlib with some methods of
 * Fady Khalife (http://code.google.com/p/ext-js-4-tinymce-ux/source/browse/trunk/ux/form/TinyMCE.js)
 * @see http://www.sencha.com/forum/showthread.php?138436-TinyMCE-form-field
 *
 * @contributor Harald Hanek
 * @license MIT (http://www.opensource.org/licenses/mit-license.php)
 */
Ext.define("Ext.ux.form.field.TinyMCE", {
    extend: 'Ext.form.field.TextArea',
    alias: 'widget.tinymcefield',

    requires: ['Ext.ux.form.field.TinyMCEWindowManager'],

    config: {
        height: 170
    },

    hideBorder: false,
    inProgress: false,
    lastWidth: 0,
    lastHeight: 0,

    statics: {
        tinyMCEInitialized: false,
        globalSettings: {
            theme: "modern",
            plugins: [
                "advlist autolink lists link image charmap print preview hr anchor pagebreak",
                "searchreplace wordcount visualblocks visualchars code fullscreen",
                "insertdatetime nonbreaking save table contextmenu directionality",
                "paste textcolor"
            ],
            toolbar1: "insertfile undo redo | styleselect | bold italic forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image | preview",
            image_advtab: true,
            width: '100%'
        },

        setGlobalSettings: function(settings) {
            Ext.apply(this.globalSettings, settings);
        }
    },

    constructor: function(config) {
        var me = this;

        config.height = (config.height && config.height >= me.config.height) ? config.height : me.config.height;

        Ext.applyIf(config.tinymceConfig, me.statics().globalSettings);

        me.addEvents({
            "editorcreated": true,
            "editorcontentchanged": true
        });

        me.callParent([config]);
    },

    initComponent: function() {
        var me = this;

        me.callParent(arguments);

        me.on('resize', function(elm, width, height) {

            if (!width || !height)
                return;

            me.lastWidth = width;
            me.lastHeight = (!me.editor) ? me.inputEl.getHeight() : height;

            if (!me.editor)
                me.initEditor();
            else
                me.setEditorSize(me.lastWidth, me.lastHeight);

        }, me);
    },

    initEditor: function() {
        var me = this;

        if (me.inProgress)
            return;

        me.inProgress = true;

        // Init values we do not want changed
        me.tinymceConfig.elements = me.getInputId();
        me.tinymceConfig.mode = 'exact';
        if (!!me.initialConfig.readOnly) {
            me.tinymceConfig.statusbar = false;
            me.tinymceConfig.toolbar = false;
            me.tinymceConfig.menubar = false;
            me.tinymceConfig.readonly = true;
        }
        me.tinymceConfig.height = me.inputEl.getHeight() - 5;

        me.tinymceConfig.setup = function(editor) {
            editor.on('init', function(e) {
                me.inProgress = false;
            });
            editor.on('keypress', Ext.Function.createBuffered(me.validate, 250, me));
            editor.on('change', function(e) {
                me.fireEvent("editorcontentchanged", editor);
            });
            editor.on('PostRender', function(e) {
                me.editor = editor;
                window.b = me.editor;
                window.d = me;

                /*editor.windowManager = new Ext.ux.form.field.TinyMCEWindowManager({
                    editor: me.editor
                });*/

                me.tableEl = Ext.get(editor.getContainer());//Ext.get(me.editor.id + "_tbl");
                me.iframeEl = Ext.get(me.editor.id + "_ifr");

                me.edMenubar = me.tableEl.down(".mce-menubar");
                me.edToolbar = me.tableEl.down(".mce-toolbar");
                me.edStatusbar = me.tableEl.down(".mce-statusbar");

                /*if (me.hideBorder)
                    me.tableEl.setStyle('border', '0px');*/

                Ext.Function.defer(function() {
                    me.setEditorSize(me.lastWidth, me.lastHeight);
                }, 10, me);

                me.fireEvent('editorcreated', me.editor, me);
            });
        };

        tinymce.init(me.tinymceConfig);
    },

    setEditorSize: function(width, height) {
        var me = this,
            frameHeight = height - 2;

        if (!me.editor || !me.rendered || !me.edMenubar || me.edMenubar.getHeight() > 100) {
            //Go around again, we're not quite ready yet
            Ext.Function.defer(function() {
                me.setEditorSize(width, height);
            }, 10, me);
            return;
        }

        if (me.edMenubar)
            frameHeight -= me.edMenubar.getHeight();

        if (me.edToolbar)
            frameHeight -= me.edToolbar.getHeight();

        if (me.edStatusbar)
            frameHeight -= me.edStatusbar.getHeight();

        me.iframeEl.setHeight(frameHeight);
        me.inputEl.setHeight(height);
    },

    isDirty: function() {
        var me = this;

        if (me.disabled || !me.rendered) {
            return false;
        }
        return me.editor && me.editor.initialized && me.editor.isDirty();
    },

    getValue: function() {
        if (this.editor)
            return this.editor.getContent();

        return this.value;
    },

    setValue: function(value) {
        var me = this;
        me.value = value;
        if (me.rendered)
            me.withEd(function() {
                me.editor.undoManager.clear();
                me.editor.setContent(value === null || value === undefined ? '' : value);
                me.editor.startContent = me.editor.getContent({
                    format: 'raw'
                });
                me.validate();
            });
    },

    getSubmitData: function() {
        var ret = {};
        ret[this.getName()] = this.getValue();
        return ret;
    },

    insertValueAtCursor: function(value) {
        var me = this;

        if (me.editor && me.editor.initialized) {
            me.editor.execCommand('mceInsertContent', false, value);
        }
    },

    onDestroy: function() {
        var me = this;

        if (me.editor) {
            me.editor.destroy();
        }
        me.callParent(arguments);
    },

    getEditor: function() {
        return this.editor;
    },

    getRawValue: function() {
        var me = this;

        return (!me.editor || !me.editor.initialized) ? Ext.valueFrom(me.value, '') : me.editor.getContent();
    },

    disable: function() {
        var me = this;

        me.withEd(function() {
            var editor = me.editor;

            tinymce.each(editor.controlManager.controls, function(c) {
                c.setDisabled(true);
            });

            tinymce.dom.Event.clear(editor.getBody());
            tinymce.dom.Event.clear(editor.getWin());
            tinymce.dom.Event.clear(editor.getDoc());
            tinymce.dom.Event.clear(editor.formElement);

            editor.onExecCommand.listeners = [];

            me.iframeEl.dom.contentDocument.body.contentEditable = false;
            me.iframeEl.addCls('x-form-field x-form-text');
        });

        return me.callParent(arguments);
    },

    enable: function() {
        var me = this;

        me.withEd(function() {
            var editor = me.editor;

            editor.bindNativeEvents();

            tinymce.each(editor.controlManager.controls, function(c) {
                c.setDisabled(false);
            });

            editor.nodeChanged();

            me.iframeEl.dom.contentDocument.body.contentEditable = true;
            me.iframeEl.removeCls('x-form-field x-form-text');
        });

        return me.callParent(arguments);
    },

    withEd: function(func) {
        var me = this;

        // If editor is not created yet, reschedule this call.
        if (!me.editor)
            me.on("editorcreated", function() {
                me.withEd(func);
            }, me);
        // Else if editor is created and initialized
        else if (me.editor.initialized)
            func.call(me);
        // Else if editor is created but not initialized yet.
        else
            me.editor.on("init", Ext.Function.bind(function() {
                Ext.Function.defer(func, 10, me);
            }, me));
    },

    validateValue: function(value) {
        var me = this;

        if (Ext.isFunction(me.validator)) {
            var msg = me.validator(value);
            if (msg !== true) {
                me.markInvalid(msg);
                return false;
            }
        }

        if (value.length < 1 || value === me.emptyText) {
            // if it's blank
            if (me.allowBlank) {
                me.clearInvalid();
                return true;
            }
            else {
                me.markInvalid(me.blankText);
                return false;
            }
        }

        if (value.length < me.minLength) {
            me.markInvalid(Ext.String.format(me.minLengthText, me.minLength));
            return false;
        }
        else
            me.clearInvalid();

        if (value.length > me.maxLength) {
            me.markInvalid(Ext.String.format(me.maxLengthText, me.maxLength));
            return false;
        }
        else
            me.clearInvalid();

        if (me.vtype) {
            var vt = Ext.form.field.VTypes;
            if (!vt[me.vtype](value, me)) {
                me.markInvalid(me.vtypeText || vt[me.vtype + 'Text']);
                return false;
            }
        }

        if (me.regex && !me.regex.test(value)) {
            me.markInvalid(me.regexText);
            return false;
        }
        return true;
    }
});
