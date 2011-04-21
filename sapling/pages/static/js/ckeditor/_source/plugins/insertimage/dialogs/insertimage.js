﻿/*
Copyright (c) 2003-2010, CKSource - Frederico Knabben. All rights reserved.
For licensing, see LICENSE.html or http://ckeditor.com/license
*/

(function () {
    var insertImageDialog = function (editor) {
        function sizeImage(img) {
            var maxWidth = 300;
            var maxHeight = 300;
            var oWidth = img.$.width;
            var oHeight = img.$.height;
            if(oWidth > maxWidth || oHeight > maxHeight)
            {
                var newWidth, newHeight;
                var boxRatio = maxWidth/maxHeight;
                var imgRatio = oWidth/oHeight;
                if(imgRatio > boxRatio)
                {
                    newWidth = maxWidth;
                    newHeight = oHeight * newWidth/oWidth;
                } else {
                    newHeight = maxHeight;
                    newWidth = oWidth * newHeight/oHeight;
                }
                img.setStyle('width', Math.round(newWidth) + 'px');
                img.setStyle('height', Math.round(newHeight) + 'px');
            }
        }
        function commitContent() {
            var args = arguments;

            this.foreach(function (widget) {
                if (widget.commit && widget.id) widget.commit.apply(widget, args);
            });
        }

        var onImgLoadEvent = function () {
            // Image is ready.
            var image = this.imageElement;
            image.setCustomData('isReady', 'true');
            image.removeListener('load', onImgLoadEvent);
            image.removeListener('error', onImgLoadErrorEvent);
            image.removeListener('abort', onImgLoadErrorEvent);
            this.fire('ok');
        };

        var onImgLoadErrorEvent = function () {
            // Error. Image is not loaded.
            var image = this.imageElement;
            image.removeListener('load', onImgLoadEvent);
            image.removeListener('error', onImgLoadErrorEvent);
            image.removeListener('abort', onImgLoadErrorEvent);
        };

        return {
            title: 'Insert Image',
            minWidth: 420,
            minHeight: 150,
            onShow: function () {
                this.imageElement = false;

                var editor = this.getParentEditor(),
                    sel = this.getParentEditor().getSelection(),
                    element = sel.getSelectedElement();
                if (element) {
                    this.hide();
                    editor.openDialog('simpleimage');
                }

                this.imageElement = editor.document.createElement('img');
                this.imageElement.setCustomData('isReady', 'false');
                this.setupContent();
            },
            onOk: function () {
                // if there is a file to upload, do that first
                if (this.getContentElement('Upload', 'upload').getValue()) {
                    this.getContentElement('Upload', 'uploadButton').fire('click');
                    return false;
                }

                this.commitContent(this.imageElement);

                // Remove empty style attribute.
                if (!this.imageElement.getAttribute('style')) this.imageElement.removeAttribute('style');

                // Insert a new Image.
                var spanElement = editor.document.createElement('span');
                spanElement.setAttribute('class', 'image_frame image_frame_border');
                spanElement.append(this.imageElement);
                sizeImage(this.imageElement);
                spanElement.setStyle('width', this.imageElement.getStyle('width'));
                editor.insertElement(spanElement);
                this.hide();
            },
            onLoad: function () {
                var doc = this._.element.getDocument();
                this.commitContent = commitContent;
            },
            onHide: function () {
                var urlText = this.getContentElement('Upload', 'txtUrl');
                urlText.getElement().hide();

                if (this.imageElement) {
                    this.imageElement.removeListener('load', onImgLoadEvent);
                    this.imageElement.removeListener('error', onImgLoadErrorEvent);
                    this.imageElement.removeListener('abort', onImgLoadErrorEvent);
                }
                delete this.imageElement;
            },
            contents: [{
                id: 'Upload',
                hidden: false,
                filebrowser: 'uploadButton',
                label: 'Choose a file from your computer',
                elements: [{
                    type: 'file',
                    id: 'upload',
                    label: 'Choose a file from your computer',
                    style: 'height:40px',
                    size: 34,
                    onChange: function () {
                        // Patch the upload form before submitting and add the CSRF token


                        function getCookie(key) {
                            var result;
                            // adapted from the jQuery Cookie plugin
                            return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decodeURIComponent(result[1]) : null;
                        }

                        var csrf_cookie = getCookie('csrftoken');
                        if (!csrf_cookie) return;

                        var uploadForm = this.getInputElement().$.form;
                        var csrf = uploadForm.csrfmiddlewaretoken;
                        if (csrf) return;

                        csrf = uploadForm.ownerDocument.createElement('input');
                        csrf.setAttribute('name', 'csrfmiddlewaretoken');
                        csrf.setAttribute('type', 'hidden');
                        csrf.setAttribute('value', csrf_cookie);
                        uploadForm.appendChild(csrf);
                    }
                }, {
                    type: 'fileButton',
                    id: 'uploadButton',
                    filebrowser: 'Upload:txtUrl',
                    style: 'display:none',
                    label: editor.lang.image.btnUpload,
                    'for': ['Upload', 'upload']
                }, {
                    type: 'html',
                    id: 'imagePicker',
                    html: 'Select an image: <div style="max-height: 10em; overflow-y: auto;"><div class="image_picker_msg"></div><div class="image_picker"></div></div>',
                    style: 'margin-top: 10px',
                    setup: function() {
                        var element = this.getElement().$;
                        var txtUrl = this.getDialog().getContentElement('Upload', 'txtUrl');
                        var spinner = jQuery('<em>(Loading...)</em>');
                        var no_images = jQuery('<em>(No images attached to this page)</em>');
                        var image_picker = jQuery('.image_picker', element);
                        var message = jQuery('.image_picker_msg', element);
                        message.empty().append(spinner);
                        jQuery.get('_files/', function(data){
                        	var result = jQuery('.file_list', data)
                        					.find('a')
                        					.click(function(){
	                                            txtUrl.setValue(jQuery(this).attr('href'));
	                                            return false;
                                        	})
                                    		.end();
                            message.empty();
                            image_picker.empty();
                            if(result.find('a').length)
                            	image_picker.append(result);
                            else message.append(no_images);
                            
                        });
                    }
                }, {
                    type: 'html',
                    id: 'webImageHint',
                    html: 'or <span style="color:blue;text-decoration:underline;cursor:pointer;">use an image from the web</span>',
                    style: 'float:left;margin-top:10px',
                    onClick: function () {
                        var urlText = this.getDialog().getContentElement('Upload', 'txtUrl');
                        urlText.getElement().show();
                        urlText.focus();
                    }
                }, {
                    type: 'text',
                    id: 'txtUrl',
                    label: 'Image URL',
                    style: 'height:40px',
                    size: 38,
                    hidden: true,
                    required: true,
                    onChange: function () {
                        var dialog = this.getDialog(),
                            newUrl = this.getValue();

                        //Update original image
                        if (newUrl.length > 0) //Prevent from load before onShow
                        {
                            dialog = this.getDialog();
                            var image = dialog.imageElement;
                            image.setCustomData('isReady', 'false');
                            image.on('load', onImgLoadEvent, dialog);
                            image.setAttribute('src', newUrl);
                        }
                    },
                    commit: function (element) {
                        if (this.getValue() || this.isChanged()) {
                            element.setCustomData('isReady', 'false');
                            element.on('load', onImgLoadEvent, this.getDialog());
                            element.setAttribute('_cke_saved_src', decodeURI(this.getValue()));
                            element.setAttribute('src', decodeURI(this.getValue()));
                        }
                    },
                    validate: function () {
                        if (this.getValue().length > 0 || this.getDialog().getContentElement('Upload', 'upload').getValue().length > 0) return true;
                        alert(editor.lang.image.urlMissing);
                        return false;
                    }
                }]
            }]
        };
    };

    CKEDITOR.dialog.add('insertimage', function (editor) {
        return insertImageDialog(editor);
    });
})();