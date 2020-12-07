define(['libs/backbone',
'css!styles/slide_editor/operatingTable.css',
'strut/slide_components/ComponentFactory',
'strut/editor/GlobalEvents',
'strut/deck/Component',
'strut/deck/Utils',
'./Utils',
'marked'],
function(Backbone, empty, ComponentFactory, GlobalEvents, Component,
	DeckUtils,
	Utils,
	marked) {
		'use strict';
		
		return Backbone.View.extend({
			className: 'operatingTable strut-surface',
			events: {
				"click": "_clicked",
				"focused": "_focus",
				// "dragover": "_dragover",
				// "drop": "_drop",
				destroyed: 'dispose'
			},
			
			initialize: function() {
				this._resize = this._resize.bind(this);
				$(window).resize(this._resize);
				
				// Re-render when active slide changes in the deck
				this._deck.on('change:activeSlide', function(deck, model) {
					this.setModel(model);
				}, this);
				this._deck.on('change:background', this._updateBg, this);
				this._deck.on('change:surface', this._updateSurface, this);
				this.setModel(this._deck.get('activeSlide'));
				
				
				var __self = this;
				var __cut = function(e){ __self._cut(__self, e);};
				var __copy = function(e){ __self._copy(__self, e);};
				var __paste = function(e){ __self._paste(__self, e);};
				
				document.addEventListener('cut', __cut);
				document.addEventListener('copy', __copy);
				document.addEventListener('paste', __paste);
				
				// GlobalEvents.on('cut', this._cut, this);
				// GlobalEvents.on('copy', this._copy, this);
				// GlobalEvents.on('paste', this._paste, this);
				// GlobalEvents.on('delete', this._delete, this);
				
				this._clipboard = this._editorModel.clipboard;
				
				// ContextMenu.setModel(this._menuModel);
			},
			
			render: function() {
				this._$slideContainer = $('<div class="slideContainer"></div>')
				this.$el.html(this._$slideContainer);
				this._$slideContainer.css(config.slide.size);
				
				DeckUtils.applyBackground(this._$slideContainer, this.model, this._deck, {transparentForSurface: true, surfaceForDefault: true, transparentForDeckSurface: true});
				this._$markdownContent = $('<div class="markdownArea themedArea"></div>');
				this._$slideContainer.append(this._$markdownContent);
				
				this._$slideContainer.selectable({
					filter: ".component",
					selected: function(event, ui) {
						$(ui.selected).trigger('select', ui);
					},
					unselected: function(event, ui) {
						$(ui.unselected).trigger('unselect', ui);
					}
				});
				
				var self = this;
				setTimeout(function() {
					self._rendered = true;
					self._resize();
					self._renderContents();
				}, 0);
				
				this.$el.addClass((this._deck.get('surface') || 'bg-default'));
				
				return this;
			},
			
			_updateBg: function(model, bg) {
				if (!this._$slideContainer) return;
				this._$slideContainer.removeClass();
				this._$slideContainer.addClass('slideContainer ui-selectable');
				DeckUtils.applyBackground(this._$slideContainer, this.model, this._deck, {transparentForSurface: true, surfaceForDefault: true});
			},
			
			_updateSurface: function(model, bg) {
				bg = DeckUtils.slideSurface(model, this._deck);
				if (bg) {
					if (!DeckUtils.isImg(bg)) {
						this.$el.css('background-image', '');
						this.$el.removeClass();
						// TODO: we can do this more intelligently
						this.$el.addClass('operatingTable strut-surface ' + bg);
					} else {
						this.$el.css('background-image', DeckUtils.getImgUrl(bg));
					}
				}
			},
			
			// TODO: make the cut/copy/paste interfaces identical for
			// slides and slide components so we can mix this code into both?
			_cut: function(self, e) {
				if (self._editorModel.get('scope') == 'operatingTable') {
					var components = self.model.selected;
					if (components.length) {
						e.clipboardData.setData('text/json', JSON.stringify(components));
						self.model.remove(components);
						e.preventDefault()
					}
				}
			},
			
			_copy: function(self, e) {
				if (self._editorModel.get('scope') == 'operatingTable') {
					var components = self.model.selected
					if (components.length) {
						e.clipboardData.setData('text/json', JSON.stringify(components));
						e.preventDefault();
					}
				}
			},
			
			_paste: function(self, e) {
				var cp = (e.clipboardData || e.originalEvent.clipboardData);
				
				var clipItems = (e.clipboardData || e.originalEvent.clipboardData).items;
				for (var index = 0; index < clipItems.length; index++) {
					var item = clipItems[index];
					if(item.type==='text/json'){
						try {
							var components = JSON.parse(cp.getData(item.type));
							if (components != null && components.length /* && components[0] instanceof Component */) {
								components.map(function(c){
									self.model.add(ComponentFactory.instance.createModel(c));
								});
							}				
							
						} catch (error) {
							console.error(error);
						}
						break;
					}
					if(item.kind==='file'){
						var blob = item.getAsFile();
						var reader = new FileReader();
						reader.onload = function(event){
							if(item.type.indexOf("image") !== -1){
								self.model.add(ComponentFactory.instance.createModel({ "src": event.target.result, "type": "Image", "x": 144, "y": 75, "scale": { "x": 1, "y": 1 }, "imageType": "COM/SIMGAD/18306147304701963075", "selected": false}));	
							}
						}; // data url!
						reader.readAsDataURL(blob);
						break;
					}
					var component = {"TextBox": {},"x": 796,"y": 78,"scale": { "x": 1, "y": 1 },"type": "TextBox","text": "<font>Text</font>","size": 72,"selected": true};
					component.text = cp.getData(item.type);
					self.model.add(ComponentFactory.instance.createModel(component));
				}
				
				e.cancelBubble = true;
				e.preventDefault();
				
				// var components = this._clipboard.getItems();
				// if (components != null && components.length && components[0] instanceof Component) {
				// 	this.model.add(components);
				// }
			},
			
			_delete: function() {
				if (this._editorModel.get('scope') == 'operatingTable') {
					var components = this.model.selected;
					if (components.length) {
						this.model.remove(components);
					}
				}
			},
			
			_clicked: function() {
				this._focus();
				this.model.get('components').forEach(function(comp) {
					if (comp.get('selected')) {
						comp.set('selected', false);
					}
				});
				this.$el.find('.editable').removeClass('editable').attr('contenteditable', false)
				.trigger('editComplete');
				
				this._focus();
			},
			
			_focus: function() {
				this._editorModel.set('scope', 'operatingTable');
			},
			
			_dragover: function(e) {
				e.stopPropagation()
				e.preventDefault()
				e.originalEvent.dataTransfer.dropEffect = 'copy'
			},
			
			_drop: function(e) {
				e.stopPropagation()
				e.preventDefault()
				var f = e.originalEvent.dataTransfer.files[0]
				
				if (!f.type.match('image.*'))
				return
				
				var reader = new FileReader()
				var self = this;
				reader.onload = function(e) {
					self.model.add(
						ComponentFactory.instance.createModel({
							type: 'Image',
							src: e.target.result
						}));
					};
					
					reader.readAsDataURL(f)
				},
				
				_componentAdded: function(model, comp) {
					var view = ComponentFactory.instance.createView(comp);
					this._$slideContainer.append(view.render());
				},
				
				setModel: function(model) {
					var prevModel = this.model;
					if (this.model === model) return;
					
					if (this.model != null) {
						this.model.off(null, null, this);
					}
					this.model = model;
					if (this.model != null) {
						this.model.on('change:components.add', this._componentAdded, this);
						this.model.on('change:background', this._updateBg, this);
						this.model.on('change:markdown', this._renderMarkdown, this);
						this.model.on('change:surface', this._updateSurface, this);
						this._updateBg();
						this._updateSurface(this.model, this.model.get('surface'));
					}
					this._renderContents(prevModel);
					return this;
				},
				
				dispose: function() {
					$(window).off('resize', this._resize);
					this._deck.off(null, null, this);
					if (this.model)
					this.model.off(null, null, this);
					GlobalEvents.off(null, null, this);
				},
				
				_renderContents: function(prevModel) {
					if (prevModel != null) {
						prevModel.trigger('unrender', true);
					}
					
					if (!this._rendered) return;
					
					if (this.model != null) {
						var components = this.model.get('components');
						components.forEach(function(comp) {
							var view = ComponentFactory.instance.createView(comp);
							this._$slideContainer.append(view.render());
						}, this);
						
						this._renderMarkdown();
					}
				},
				
				_renderMarkdown: function() {
					if (this.model.get('markdown')) {
						this._$markdownContent.html(marked(this.model.get('markdown')));
					} else {
						this._$markdownContent.html('');
					}
				},
				
				_resize: function() {
					var dimensions = Utils.computeSlideDimensions(this.$el);
					this._$slideContainer.css({
						'margin-left': dimensions.remainingWidth / 2,
						'margin-right': dimensions.remainingWidth / 2
					});
					
					this._$slideContainer.css(window.browserPrefix + 'transform', 'scale(' + dimensions.scale + ')');
				},
				
				constructor: function OperatingTable(editorModel, slideEditorModel) {
					this._deck = editorModel.deck();
					this._registry = editorModel.registry;
					this._editorModel = editorModel;
					this._slideEditorModel = slideEditorModel;
					Backbone.View.prototype.constructor.call(this);
				}
			});
		});
		