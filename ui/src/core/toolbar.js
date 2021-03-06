// NAVIGATOR Module

// Load templates
const ToolbarTemplate = require('../templates/toolbar.hbs');
const ToolbarLayoutJumpList = require('../templates/toolbar-layout-jump-list.hbs');

// Add global helpers
window.formHelpers = require('../helpers/form-helpers.js');

const toolsList = [
    {
        name: 'Region',
        type: 'region',
        description: 'Add a region to the layout',
        imageUri: 'designer/region.png',
        dropTo: 'layout'
    },
    {
        name: 'Audio',
        type: 'audio',
        description: 'Attach audio to a widget',
        imageUri: 'designer/audio.png',
        dropTo: 'widget'
    },
    {
        name: 'Expiry Dates',
        type: 'expiry',
        description: 'Set expiry dates to a widget',
        imageUri: 'designer/expiry.png',
        dropTo: 'widget'
    },
    {
        name: 'Transition In',
        type: 'transitionIn',
        description: 'Add a in transition to a widget',
        imageUri: 'designer/transitionIn.png',
        dropTo: 'widget'
    },
    {
        name: 'Transition Out',
        type: 'transitionOut',
        description: 'Add a out transition to a widget',
        imageUri: 'designer/transitionOut.png',
        dropTo: 'widget'
    }
];

const defaultMenuItems = [
    {
        name: 'tools',
        title: 'Tools',
        tool: true,
        pagination: false,
        page: 0,
        content: [],
        state: ''
    },
    {
        name: 'widgets',
        title: 'Widgets',
        pagination: false,
        page: 0,
        content: [],
        state: ''
    }
];

/**
 * Bottom toolbar contructor
 * @param {object} container - the container to render the navigator to
 * @param {object[]} [customButtons] - customized buttons
 * @param {object} [customActions] - customized actions
 */
let Toolbar = function(container, customButtons = [], customActions = {}, jumpList = {}) {
    this.DOMObject = container;
    this.openedMenu = -1;
    this.previousOpenedMenu = -1;

    this.menuItems = defaultMenuItems;
    this.menuIndex = 0;

    // Number of tabs that are fixed ( not removable and always defaulted )
    this.fixedTabs = defaultMenuItems.length;

    // Layout jumplist
    this.jumpList = jumpList;

    // Custom buttons
    this.customButtons = customButtons;

    // Custom actions
    this.customActions = customActions;

    this.contentDimentions = {
        width: 90 // In percentage
    };

    this.cardDimensions = {
        width: 100, // In pixels
        height: 80, // In pixels
        margin: 2 // In pixels
    };

    this.selectedCard = {};

    // Load user preferences
    this.loadPrefs();
};

/**
 * Load user preferences
 */
Toolbar.prototype.loadPrefs = function() {

    // Load using the API
    const linkToAPI = urlsForApi.user.getPref;

    // Request elements based on filters
    let self = this;
    $.ajax({
        url: linkToAPI.url + '?preference=toolbar',
        type: linkToAPI.type
    }).done(function(res) {

        if(res.success) {

            let loadedData = JSON.parse(res.data.value);

            // Populate the toolbar with the returned data
            self.menuItems = (jQuery.isEmptyObject(loadedData.menuItems)) ? defaultMenuItems : defaultMenuItems.concat(loadedData.menuItems);
            self.openedMenu = (loadedData.openedMenu) ? loadedData.openedMenu : -1;
            self.previousOpenedMenu = (loadedData.previousOpenedMenu) ? loadedData.openedMenu : -1;
            
            // Set menu index
            self.menuIndex = self.menuItems.length;

            // Render to reflect the loaded toolbar
            self.render();

            // If there was a opened menu, load content for that one
            if(self.openedMenu != -1) {
                self.loadContent(self.openedMenu);
            }
        } else {

            // Login Form needed?
            if(res.login) {

                window.location.href = window.location.href;
                location.reload(false);
            } else {
                // Just an error we dont know about
                if(res.message == undefined) {
                    console.error(res);
                } else {
                    console.error(res.message);
                }

                // Render toolbar even if the user prefs load fail
                self.render();
            }
        }

    }).catch(function(jqXHR, textStatus, errorThrown) {

        console.error(jqXHR, textStatus, errorThrown);
        toastr.error('User load preferences failed!');

    });
};

/**
 * Save user preferences
 * @param {bool=} [clearPrefs = false] - Force reseting user prefs
 */
Toolbar.prototype.savePrefs = function(clearPrefs = false) {
    
    // Save only some of the tab menu data
    let menuItemsToSave = [];
    let openedMenu = this.openedMenu;
    let previousOpenedMenu = this.previousOpenedMenu;

    if(clearPrefs) {
        menuItemsToSave = {};
        openedMenu = -1;
        previousOpenedMenu = -1;
    } else {
        for(let index = this.fixedTabs;index < this.menuItems.length;index++) {

        // Make a copy of the current element
        let elementCopy = Object.assign({}, this.menuItems[index]);

        // Remove content and set page to 0
        elementCopy.content = [];
        elementCopy.page = 0;
        
        menuItemsToSave.push(elementCopy);
    }
    }

    let dataToSave = {
        preference: [
            {
                option: 'toolbar',
                value: JSON.stringify({
                    menuItems: menuItemsToSave,
                    openedMenu: openedMenu,
                    previousOpenedMenu: previousOpenedMenu
                })
            }
        ]
    };

    // Save using the API
    const linkToAPI = urlsForApi.user.savePref;

    // Request elements based on filters
    let self = this;
    $.ajax({
        url: linkToAPI.url,
        type: linkToAPI.type,
        data: dataToSave
    }).done(function(res) {

        if(!res.success) {
            // Login Form needed?
            if(res.login) {

                window.location.href = window.location.href;
                location.reload(false);
            } else {

            toastr.error('User save preferences failed!');

                // Just an error we dont know about
                if(res.message == undefined) {
                    console.error(res);
                } else {
                    console.error(res.message);
                }

                // Render toolbar even if the user prefs load fail
                self.render();
            }
        }

    }).catch(function(jqXHR, textStatus, errorThrown) {

        console.error(jqXHR, textStatus, errorThrown);
        toastr.error('User save preferences failed!');
    });

};

/**
 * Render toolbar
 */
Toolbar.prototype.render = function() {

    let self = this;
    const app = getXiboApp();

    // Deselect selected card on render
    this.selectedCard = {};

    // Compile layout template with data
    const html = ToolbarTemplate({
        opened: (this.openedMenu != -1),
        menuItems: this.menuItems,
        tabsCount: (this.menuItems.length > this.fixedTabs),
        customButtons: this.customButtons,
        trashActive: (app.selectedObject.type === 'region' || app.selectedObject.type === 'widget')
    });

    // Append layout html to the main div
    this.DOMObject.html(html);

    // Handle tabs
    for(let i = 0;i < this.menuItems.length;i++) {

        const toolbar = self;
        const index = i;

        this.DOMObject.find('#btn-menu-' + index).click(function() {
            toolbar.openTab(index);
        });

        this.DOMObject.find('#close-btn-menu-' + index).click(function() {
            toolbar.deleteTab(index);
        });

        this.DOMObject.find('#content-' + index + ' #pag-btn-left').click(function() {
            toolbar.menuItems[index].page -= 1;
            toolbar.loadContent(index);
        });

        this.DOMObject.find('#content-' + index + ' #pag-btn-right').click(function() {
            toolbar.menuItems[index].page += 1;
            toolbar.loadContent(index);
        });

    }

    // Toggle button
    this.DOMObject.find('#btn-menu-toggle').click(function() {
        self.openTab();
    });

    // Create new tab
    this.DOMObject.find('#btn-menu-new-tab').click(function(){
        self.createNewTab();
    });

    // Close all tabs
    this.DOMObject.find('#deleteAllTabs').click(function() {
        self.deleteAllTabs();
    });

    // Search button
    this.DOMObject.find('.search-btn').click(function() {
        
        // Reset page
        self.menuItems[$(this).attr("data-search-id")].page = 0;

        // Load content for the search tab
        self.loadContent($(this).attr("data-search-id"));
    });

    // Delete object
    this.DOMObject.find('#trashContainer').click(
        this.customActions.deleteSelectedObjectAction
    ).droppable({
        drop: function(event, ui) {
            self.customActions.deleteDraggedObjectAction(ui.draggable);
        }
    });

    // Handle custom buttons
    for(let index = 0;index < this.customButtons.length;index++) {

        // Bind action to button
        this.DOMObject.find('#' + this.customButtons[index].id).click(
            this.customButtons[index].action
        );

        // If there is a inactiveCheck, use that function to switch button state
        if(this.customButtons[index].inactiveCheck != undefined) {
            const inactiveClass = (this.customButtons[index].inactiveCheckClass != undefined) ? this.customButtons[index].inactiveCheckClass : 'disabled';
            const toggleValue = this.customButtons[index].inactiveCheck();
            this.DOMObject.find('#' + this.customButtons[index].id).toggleClass(inactiveClass, toggleValue);
        }
    }

    // Set layout jumpList if exists
    if(!$.isEmptyObject(this.jumpList) && $('#layoutJumpList').length == 0) {
        this.setupJumpList($("#layoutJumpListContainer"));
    }

    // Set cards width/margin and draggable properties
    this.DOMObject.find('.toolbar-card').width(
        this.cardDimensions.width
    ).height(
        this.cardDimensions.height
    ).css(
        'margin', this.cardDimensions.margin
    ).draggable({
        cursor: 'crosshair',
        handle: '.drag-area',
        cursorAt: {
            top: (this.cardDimensions.height + this.cardDimensions.margin) / 2,
            left: (this.cardDimensions.width + this.cardDimensions.margin) / 2
        },
        opacity: 0.3,
        helper: 'clone',
        start: function() {
            $('.custom-overlay').show();
        }, 
        stop: function() {
            // Hide designer overlay
            $('.custom-overlay').hide();
        }
    });

    // Set cards width/margin and draggable properties
    this.DOMObject.find('.toolbar-card:not(.card-selected) .add-area').click((e) => {
        self.selectCard($(e.currentTarget).parent()); 
    });

    // Initialize tooltips
    this.DOMObject.find('[data-toggle="tooltip"]').tooltip();
};

/**
 * Load content
 * @param {number} menu - menu to load content for
 */
Toolbar.prototype.loadContent = function(menu = -1) {

    // Calculate pagination
    const pagination = this.calculatePagination(menu);

    // Enable/Disable page down pagination button according to the page to display
    this.menuItems[menu].pagBtnLeftDisabled = (pagination.start == 0) ? 'disabled' : '';

    // Replace search button with a spinner icon
    this.DOMObject.find('.search-btn').html('<i class="fa fa-spinner fa-spin"></i>');

    if(menu < this.fixedTabs) { // Fixed Tabs

        switch(menu) {
            // Tools
            case 0:
                this.menuItems[menu].content = toolsList;
                break;

            // Widgets
            case 1:
                this.menuItems[menu].content = modulesList;
                break;

            default:
                this.menuItems[menu].content = [];
                break;
        }

        for(let index = 0;index < this.menuItems[menu].content.length;index++) {
            const element = this.menuItems[menu].content[index];

            element.maxSize = libraryUpload.maxSize;
            element.maxSizeMessage = libraryUpload.maxSizeMessage;

            // Hide element if it's outside the "to display" region
            element.hideElement = (index < pagination.start || index >= (pagination.start + pagination.length));
        }

        // Enable/Disable page up pagination button according to the page to display and total elements
        this.menuItems[menu].pagBtnRightDisabled = ((pagination.start + pagination.length) >= this.menuItems[menu].content.length) ? 'disabled' : '';
        
        this.menuItems[menu].state = 'active';

        // Save user preferences
        this.savePrefs();

        this.render();

    } else { // Generated tabs ( search )

        // Load using the API
        const linkToAPI = urlsForApi.library.get;

        // Save filters
        this.menuItems[menu].filters.name.value = this.DOMObject.find('#media-search-form-' + menu + ' #input-name').val();
        this.menuItems[menu].filters.tag.value = this.DOMObject.find('#media-search-form-' + menu + ' #input-tag').val();
        this.menuItems[menu].filters.type.value = this.DOMObject.find('#media-search-form-' + menu + ' #input-type').val();

        // Create filter
        let customFilter = {
            retired: 0,
            assignable: 1,
            start: pagination.start,
            length: pagination.length,
            media: this.menuItems[menu].filters.name.value,
            tags: this.menuItems[menu].filters.tag.value,
            type: this.menuItems[menu].filters.type.value
        };

        // Change tab name to reflect the search query
        if(customFilter.media != '' && customFilter.media != undefined) {
            this.menuItems[menu].title = '"' + customFilter.media + '"';
        } else {
            this.menuIndex += 1;
            this.menuItems[menu].title = 'Tab ' + this.menuIndex;
        }

        if(customFilter.tags != '' && customFilter.tags != undefined) {
            this.menuItems[menu].title += ' {' + customFilter.tags + '} ';
        }

        if(customFilter.type != '' && customFilter.type != undefined) {
            this.menuItems[menu].title += ' [' + customFilter.type + '] ';
        }

        // Request elements based on filters
        let self = this;
        $.ajax({
            url: linkToAPI.url,
            type: linkToAPI.type,
            data: customFilter
        }).done(function(res) {

            if(res.data.length == 0) {
                toastr.info('No results for the filter!', 'Search');
                self.menuItems[menu].content = null;
            } else {
                self.menuItems[menu].content = res.data;
            }

            // Enable/Disable page up pagination button according to the page to display and total elements
            self.menuItems[menu].pagBtnRightDisabled = ((pagination.start + pagination.length) >= res.recordsTotal) ? 'disabled' : '';

            // Save user preferences
            self.savePrefs();

            self.render();
        }).catch(function(jqXHR, textStatus, errorThrown) {

            console.error(jqXHR, textStatus, errorThrown);
            toastr.error('Library load failed!');

            self.menuItems[menu].content = null;
        });
    }
};

/**
 * Open menu
 * @param {number} menu - menu to open index, -1 by default and to toggle
 */
Toolbar.prototype.openTab = function(menu = -1) {

    // Toggle previous opened menu
    if(menu == -1) {

        if(this.openedMenu != -1) { // Close opened tab
            this.previousOpenedMenu = this.openedMenu;
        this.menuItems[this.openedMenu].state = '';
        this.openedMenu = -1;
        } else if(this.previousOpenedMenu != -1) { // Reopen previously opened tab
            this.menuItems[this.previousOpenedMenu].state = 'active';
            this.openedMenu = this.previousOpenedMenu;
            this.previousOpenedMenu = -1;

            // If menu is the default/widget, load content
            if(this.openedMenu < this.fixedTabs && this.openedMenu > -1) {
                this.loadContent(this.openedMenu);
                return; // To avoid double save and render
            }
        }
    } else { // Open specific menu

        // Close all menus
        for(let index = this.menuItems.length - 1;index >= 0;index--) {
            this.menuItems[index].state = '';
        }

        this.menuItems[menu].state = 'active';
        this.openedMenu = menu;
        this.previousOpenedMenu = -1;

        // If menu is the default/widget/tools, load content
        if(menu < this.fixedTabs && menu > -1) {
            this.loadContent(menu);
            return; // To avoid double save and render
        }
    }

    // Save user preferences
    this.savePrefs();

    this.render();
};

/**
 * Create new tab
 */
Toolbar.prototype.createNewTab = function() {

    let moduleListFiltered = [];

    // Filter module list to create the types for the filter
    modulesList.forEach(element => {
        if(element.assignable == 1 && element.regionSpecific == 0) {
            moduleListFiltered.push(element);
        }
    });

    this.menuIndex += 1;

    this.menuItems.push({
        name: 'search',
        title: 'Tab ' + this.menuIndex,
        search: true,
        page: 0,
        query: '',
        filters: {
            name: {
                name: 'Name',
                value: ''
            },
            tag: {
                name: 'Tag',
                value: ''
            },
            type: {
                name: 'Type',
                values: moduleListFiltered
            },
        },
        content: []
    });

    this.openTab(this.menuItems.length - 1);

    this.render();
};

/**
 * Delete tab
 * @param {number} menu
 */
Toolbar.prototype.deleteTab = function(menu) {

    this.menuItems.splice(menu, 1);

    if(this.openedMenu >= this.fixedTabs) {
    this.openedMenu = -1;
        this.previousOpenedMenu = -1;
    }

    // Save user preferences
    this.savePrefs();

    this.render();
};

/**
 * Delete all tabs
 */
Toolbar.prototype.deleteAllTabs = function() {

    for(let index = this.menuItems.length - 1;index >= this.fixedTabs;index--) {
        this.menuItems.splice(index, 1);
    }
    
    if(this.openedMenu >= this.fixedTabs) {
    this.openedMenu = -1;
        this.previousOpenedMenu = -1;
    }

    // Save user preferences
    this.savePrefs();
    
    this.render();
};

/**
 * Calculate pagination
 * @param {number} menu
 */
Toolbar.prototype.calculatePagination = function(menu) {
    
    // Get page and number of elements
    const currentPage = this.menuItems[menu].page;

    // Calculate width
    const containerWidth = this.DOMObject.find('.toolbar-content').width() * (this.contentDimentions.width / 100);

    // Calculate number of elements to display
    const elementsToDisplay = Math.floor(containerWidth / (this.cardDimensions.width + this.cardDimensions.margin * 2));

    this.menuItems[menu].contentWidth = this.contentDimentions.width;

    return {
        start: currentPage * elementsToDisplay,
        length: elementsToDisplay
    };
};

/**
* Setup layout jumplist
* @param {object} jumpListContainer
*/
Toolbar.prototype.setupJumpList = function(jumpListContainer) {

    const html = ToolbarLayoutJumpList(this.jumpList);
    const self = this;

    // Append layout html to the main div
    jumpListContainer.html(html);

    jumpListContainer.show();

    const jumpList = jumpListContainer.find('#layoutJumpList');

    jumpList.select2({
        ajax: {
            url: jumpList.data().url,
            dataType: "json",
            data: function(params) {

                var query = {
                    layout: params.term,
                    start: 0,
                    length: 10
                };

                // Set the start parameter based on the page number
                if(params.page != null) {
                    query.start = (params.page - 1) * 10;
                }

                // Find out what is inside the search box for this list, and save it (so we can replay it when the list
                // is opened again)
                if(params.term !== undefined) {
                    localStorage.liveSearchPlaceholder = params.term;
                }

                return query;
            },
            processResults: function(data, params) {
                var results = [];

                $.each(data.data, function(index, element) {
                    results.push({
                        "id": element.layoutId,
                        "text": element.layout
                    });
                });

                var page = params.page || 1;
                page = (page > 1) ? page - 1 : page;

                return {
                    results: results,
                    pagination: {
                        more: (page * 10 < data.recordsTotal)
                    }
                };
            },
            delay: 250
        }
    });

    jumpList.on("select2:select", function(e) {
        // OPTIMIZE: Maybe use the layout load without reloading page
        //self.jumpList.callback(e.params.data.id);

        // Go to the Layout we've selected.
        window.location = jumpList.data().designerUrl.replace(":id", e.params.data.id);
    }).on("select2:opening", function(e) {
        // Set the search box according to the saved value (if we have one)
        
        if(localStorage.liveSearchPlaceholder != null && localStorage.liveSearchPlaceholder !== "") {
            var $search = jumpList.data("select2").dropdown.$search;
            $search.val(localStorage.liveSearchPlaceholder);

            setTimeout(function() {
                $search.trigger("input");
            }, 100);
        }
    });
};

/**
 * Select toolbar card so it can be used
 * @param {object} card - DOM card to select/activate
 */
Toolbar.prototype.selectCard = function(card) {

    const previouslySelected = this.selectedCard;

    // Deselect previous selections
    this.deselectCardsAndDropZones();

    if(previouslySelected[0] != card[0]) {
        // Select new card
        $(card).addClass('card-selected');

        // Get card info
        const dropTo = $(card).attr('drop-to');

        // Save selected card data
        this.selectedCard = card;

        // Show designer overlay
        $('.custom-overlay').show().unbind().click(() => {
            this.deselectCardsAndDropZones();
        });

        // Set droppable areas as active
        $('[data-type="' + dropTo + '"].ui-droppable').addClass('ui-droppable-active');
    }
};

/**
 * Deselect all the cards and remove the overlay on the drop zones
 */
Toolbar.prototype.deselectCardsAndDropZones = function() {
    // Deselect other cards
    this.DOMObject.find('.toolbar-card.card-selected').removeClass('card-selected');

    // Remove drop class from droppable elements
    $('.ui-droppable').removeClass('ui-droppable-active');

    // Hide designer overlay
    $('.custom-overlay').hide().unbind();

    // Deselect card
    this.selectedCard = {};
};

module.exports = Toolbar;