/**
 * File Manager plugin for jWYSIWYG
 * 
 * Yotam Bar-On, 2011
 * 
 * The file manager plugin does not currently support i18n 
 */
(function ($) {
	if (undefined === $.wysiwyg) {
		throw "wysiwyg.fileManager.js depends on $.wysiwyg";
	}

	/*
	 * Wysiwyg namespace: public properties and methods
	 */
	 // Only for show
	 var fileManager = {
		name: "fileManager",
		version: "0.98", // Same as jwysiwyg
		ajaxHandler: "",
		selected: null,
		setAjaxHandler: function (_handler) {
			this.ajaxHandler = _handler;
			return this;
		},
		isAjaxSet: function () {
			if (this.ajaxHandler) {
				return true;
			} else {
				return false;
			}
		},
		init: function (callback) {
			if (this.ajaxHandler) {
				manager = new fileManagerObj(this.ajaxHandler);
				manager.load(callback);
			} else {
				return false;
			}
		}
		
	 }
	// Register:
	$.wysiwyg.plugin.register(fileManager);
	
	
	
	// Private object:
	function fileManagerObj (_handler) {
		this.handler = _handler;
		this.loaded = false;
		this.move = false;
		this.rename = false;
		this.remove = false;
		this.upload = false;
		this.mkdir = false;
		this.selectedFile = "";
		this.curDir = "/";
		this.curListHtml = "";
		
		/*
		 * Methods
		 */
		 
		this.load = function (callback) {
			var self = this;
			self.loaded = true;
			self.authenticate(function (response) {
				if (response !== "success") {
					alert(response);
					return false;
				}
				// Wrap the file list:
				self.loadDir("/", function (fileList) {
					var uiHtml = 	'<div class="wysiwyg-files-wrapper" title="File Manager">' +
									'<input type="text" name="url" />' +
									'<div id="wysiwyg-files-list-wrapper">'+fileList+'</div>' +
									'<div class="wysiwyg-files-action-upload" title="Upload new file to current directory"></div>' +
									'<div class="wysiwyg-files-action-mkdir" title="Create new directory"></div>' +
									'<input style="display:none;" type="button" name="submit" value="Select" />' +
									'</div>';
					if ($.wysiwyg.dialog) {
						// Future support for native $.wysiwyg.dialog()
						$.wysiwyg.dialog(uiHtml);
					} else if ($.fn.dialog()) {
						$(uiHtml).dialog({
							modal: true,
							draggable: true,
							resizable: true,
							close: function () {
								$(this).dialog("destroy");
								$(this).remove();
							},
							open: function () {
								dialog = $(this);
								// Hover effect:
								dialog.find("li").live("mouseenter", function () {
									$(this).addClass("wysiwyg-files-hover");
									
									if ($(this).hasClass("wysiwyg-files-dir")) {
										$(this).addClass("wysiwyg-files-dir-expanded");
									}
									// Add action buttons:
									if (!$(this).hasClass("wysiwyg-files-dir-prev")) {
										$(".wysiwyg-files-action").remove();
										$("<div/>", { "class": "wysiwyg-files-action wysiwyg-files-action-remove", "title": "Remove" }).appendTo(this);
										$("<div/>", { "class": "wysiwyg-files-action wysiwyg-files-action-rename", "title": "Rename" }).appendTo(this);
									}
								}).live("mouseleave", function () {
									$(this).removeClass("wysiwyg-files-dir-expanded");
									$(this).removeClass("wysiwyg-files-hover");
									
									// Remove action buttons:
									$(".wysiwyg-files-action").remove();
								});
								
								// Browse:
								dialog.find("li").find("a").live("click", function (e) {
									self.selectedFile = $(this).attr("rel");
									$(".wysiwyg-files-wrapper").find("li").css("backgroundColor", "#FFF");
									
									// Browse Directory:
									if ($(this).parent("li").hasClass("wysiwyg-files-dir")) {
										self.selectedFile = "";
										dialog.find("input[name=submit]").hide();
										$(".wysiwyg-files-wrapper").find("input[name=url]").val('');
										$('#wysiwyg-files-list-wrapper').addClass("wysiwyg-files-ajax");
										$('#wysiwyg-files-list-wrapper').html("");
										self.loadDir($(this).attr("rel"), function (newFileList) {
											$('#wysiwyg-files-list-wrapper').html(newFileList);
											$('#wysiwyg-files-list-wrapper').removeClass("wysiwyg-files-ajax");
										});
										dialog.find("input[name=submit]").hide();
										
									// Select Entry:
									} else {
										self.selectedFile = $(this).text();
										$(this).parent("li").css("backgroundColor", "#BDF");
										$(".wysiwyg-files-wrapper").find("input[name=url]").val($(this).attr("rel"));
										dialog.find("input[name=submit]").show();
									}
									
								});

								// Select file bindings
								dialog.find("input[name=submit]").live("click", function () {
									var file = dialog.find("input[name=url]").val();
									dialog.dialog("close");
									self.loaded = false;
									callback(file);
								});
								dialog.find("li.wysiwyg-files-file").live("dblclick", function () {
									$(this).trigger("click");
									dialog.find("input[name=submit]").trigger("click");
								});
								
								// Image preview bindings
								dialog.find("li.wysiwyg-files-png, li.wysiwyg-files-jpg, li.wysiwyg-files-jpeg, li.wysiwyg-files-gif, li.wysiwyg-files-ico, li.wysiwyg-files-bmp").live("mouseenter", function () {
									var $this = $(this);
									$("<img/>", { "class": "wysiwyg-files-ajax wysiwyg-files-file-preview", "src": $this.attr("rel"), "alt": $this.text() }).appendTo("body");
									$("img.wysiwyg-files-file-preview").load(function () {
										$(this).removeClass("wysiwyg-files-ajax");
									});
								}).live("mousemove", function (e) {
									$("img.wysiwyg-files-file-preview").css("left", e.pageX + 15);
									$("img.wysiwyg-files-file-preview").css("top", e.pageY);
								}).live("mouseout", function () {
									$("img.wysiwyg-files-file-preview").remove();
								});
								
								/* 
								 * Bind action buttons:
								 */
								 
								// Remove:
								$(".wysiwyg-files-action-remove").live("click", function (e) {
									e.preventDefault();
									var entry = $(this).parent("li");
									// What are we deleting?
									var type = entry.hasClass("wysiwyg-files-file") ? "file" : "dir";
									var removeDialog = 	$('<p>Are you sure you want to delete this file?</p>');
									$(removeDialog).dialog({
										height: 120,
										draggable: true,
										modal: true,
										buttons: {
											"Yes": function () {
												var file = (type === "file") ? entry.find("a").text() : entry.find("a").attr("rel");
												self.removeFile(type, file, function (response) {
													self.loadDir(self.curDir, function (list) {
														$("#wysiwyg-files-list-wrapper").html(list);
													});
													removeDialog.dialog("close");
												});
											},
											"No": function () {
												$(this).dialog("close");
											}
										},
										close: function () {
											$(this).dialog("destroy");
											$(this).remove();
										}
									});
								});
								
								// Rename
								$(".wysiwyg-files-action-rename").live("click", function (e) {
									e.preventDefault();
									var entry = $(this).parent("li");
									// What are we deleting?
									var type = entry.hasClass("wysiwyg-files-file") ? "file" : "dir";
									var renameDialog = 	$(	'<div>' +
															'<input type="text" class="wysiwyg-files-textfield" name="newName" value="' + entry.find("a").text() + '" />' +
															'</div>');
									
									renameDialog.dialog({
										height: 120,
										draggable: true,
										modal: true,
										buttons: {
											"Rename": function () {
												var file = (type === "file") ? entry.find("a").text() : entry.find("a").attr("rel");
												self.renameFile(type, file, $(this).find("input[name=newName]").val(), function (response) {
													self.loadDir(self.curDir, function (list) {
														$("#wysiwyg-files-list-wrapper").html(list);
													});
													renameDialog.dialog("close");
												});
											},
											"Cancel": function () {
												$(this).dialog("close");
											}
										},
										close: function () {
											$(this).dialog("destroy");
											$(this).remove();
										}
									});
								});
								
								// Create Directory
								$(".wysiwyg-files-action-mkdir").live("click", function (e) {
									e.preventDefault();
									var mkdirDialog = 	$(	'<div>' +
															'<input type="text" class="wysiwyg-files-textfield" name="newName" value="New Directory" />' +
															'</div>');
									
									mkdirDialog.dialog({
										height: 120,
										draggable: true,
										modal: true,
										buttons: {
											"Create": function () {
												self.mkDir($(this).find("input[name=newName]").val(), function (response) {
													self.loadDir(self.curDir, function (list) {
														$("#wysiwyg-files-list-wrapper").html(list);
													});
													mkdirDialog.dialog("close");
												});
											},
											"Cancel": function () {
												$(this).dialog("close");
											}
										},
										close: function () {
											$(this).dialog("destroy");
											$(this).remove();
										}
									});									
								});
								
								// Upload File
								$(".wysiwyg-files-action-upload").live("click", function (e) {
									self.loadUploadUI();
								});
								
							}
							
						});
						
					} else {
						// If neither .dialog() works..
						throw "$.wysiwyg.fileManager: Can't find a working '.dialog()' lib.";
					}
				});
			});
		}
		
		this.authenticate = function (callback) {
			if (!this.loaded) {
				return false;
			}
			var self = this;
			$.getJSON(self.handler, { "action": "auth", "auth": "jwysiwyg" }, function (json) {
				if (json.success) {
					self.move = json.data.move;
					self.rename = json.data.rename;
					self.remove = json.data.remove;
					self.mkdir = json.data.mkdir;
					self.upload = json.data.upload;
					callback("success");
				} else {
					console.log("$.wysiwyg.fileManager: Unable to authenticate handler.");
					callback(json.error);
				}
			});
		}
		
		this.loadDir = function (dir, callback) {
			if (!this.loaded) {
				return false;
			}
			var self = this;
			self.curDir = dir;
			// Retreives list of files inside a certain directory:
			$.getJSON(self.handler, { "dir": self.curDir, "action": "list" }, function (json) {
				if (json.success) {
					callback(self.listDir(json));
				} else {
					alert(json.error);
				}
			});
		}
		
		/*
		 * Ajax Methods:
		 */
		
		// List Directory
		this.listDir = function (json) {
			if (!this.loaded) {
				return false;
			}
			var self = this;
			var treeHtml = '<ul class="wysiwyg-files-list">';
			if (self.curDir !== "/") {
				var prevDir = self.curDir.replace(/[^\/]+\/?$/, '');
				treeHtml += '<li class="wysiwyg-files-dir wysiwyg-files-dir-prev">' +
							'<a href="#" rel="'+prevDir+'" title="Go to previous directory">' +
							self.curDir +
							'</a></li>';
			}
			$.each(json.data.directories, function(name, dirPath) {
				treeHtml += '<li class="wysiwyg-files-dir">' +
							'<a href="#" rel="'+dirPath+'">' +
							name +
							'</a></li>';
			});			
			$.each(json.data.files, function(name, url) {
				var ext = name.replace(/^.*?\./, '').toLowerCase();
				treeHtml += '<li class="wysiwyg-files-file wysiwyg-files-'+ext+'">' +
							'<a href="#" rel="'+url+'">' +
							name +
							'</a></li>';
			});			
			treeHtml += '</ul>';
			return treeHtml;
		}
		
/*
 * Should be remembered for future implementation:
 * If handler does not support certain actions - do not show their icons/button.
 * Only action a handler MUST support is "list" (list directory).
 */
		
		// Remove File Method:
		this.removeFile = function (type, file, callback) {
			if (!this.loaded) { return false; }
			if (!this.remove.enabled) { console.log("$.wysiwyg.fileManager: handler: remove is disabled."); return false; }
			
			var self = this;
			$.getJSON(self.remove.handler, { "action": "remove", "type": type, "dir": self.curDir, "file": file  }, function (json) {
				if (json.success) {
					alert(json.data);
				} else {
					alert(json.error);
				}
				callback(json);
			});
		}
		
		// Rename File Method
		this.renameFile = function (type, file, newName, callback) {
			if (!this.loaded) { return false; }
			if (!this.rename.enabled) { console.log("$.wysiwyg.fileManager: handler: rename is disabled."); return false; }
			
			var self = this;
			$.getJSON(self.rename.handler, { "action": "rename", "type": type, "dir": self.curDir, "file": file, "newName": newName  }, function (json) {
				if (json.success) {
					alert(json.data);
				} else {
					alert(json.error);
				}
				callback(json);
			});		
		}
				
		
		// Make Directory Method
		this.mkDir = function (newName, callback) {
			if (!this.loaded) { return false; }
			if (!this.mkdir.enabled) { console.log("$.wysiwyg.fileManager: handler: mkdir is disabled."); return false; }
			
			var self = this;
			$.getJSON(self.mkdir.handler, { "action": "mkdir", "dir": self.curDir, "newName": newName  }, function (json) {
				if (json.success) {
					alert(json.data);
				} else {
					alert(json.error);
				}
				callback(json);
			});		
		}
				
				
		/*
		 * Currently we will not support moving of files. This will be supported only when a more interactive interface will be introduced.
		 */
		this.moveFile = function () {
			if (!this.loaded) { return false; }
			if (!this.rename.enabled) { console.log("$.wysiwyg.fileManager: handler: move is disabled."); return false; }	
			var self = this;
			return false;
		}
		
		// Upload:
		this.loadUploadUI = function () {
			if (!this.loaded) { return false; }
			if (!this.rename.enabled) { console.log("$.wysiwyg.fileManager: handler: move is disabled."); return false; }	
			var self = this;
			var uiHtml = 	'<form enctype="multipart/form-data" method="post" action="' + self.upload.handler + '">' + 
							'<p><input type="file" name="handle" /><br>' + 
							'<input type="text" name="newName" class="wysiwyg-files-textfield" /><br>' + 
							'<input type="text" name="action" style="display:none;" value="upload" /><br></p>' + 
							'<input type="text" name="dir" style="display:none;" value="' + self.curDir + '" /></p>' + 
							'<input type="submit" name="submit" />' +
							'</form>';
			$("<iframe/>", { "class": "wysiwyg-files-upload" }).load(function () {
				$doc = $(this).contents();
				$doc.find("body").append(uiHtml);
				$doc.find("input[type=file]").change(function () {
					$val = $(this).val();
					$val = $val.replace(/.*[\\\/]/, '');
					// Should implement validation before submiting form
					$doc.find("input[name=newName]").val($val);
				});
			}).dialog({
				height: 200,
				modal: true,
				draggable: true,
				close: function () {
					$(this).dialog("destroy");
					$(this).remove();
				}
			});
		}
		
	}
	
})(jQuery);
