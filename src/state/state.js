/**
 * state.js
 *
 * Central application state store.
 *
 * This is a plain mutable singleton object.  All mutations must go through
 * actions.js — never mutate state directly outside of that module.
 *
 * Fields:
 *
 *   chats            {Chat[]}    Full list of chats from WhatsApp Web
 *   filteredChats    {Chat[]}    Chats after search/filter applied
 *   currentChatId    {string}    DOM id of the currently open chat
 *   currentChatTitle {string}   Display name of the current chat
 *   messages         {Message[]} Messages in the current conversation
 *   connectionStatus {string}   'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'SYNCING' | 'STARTING'
 *   mode             {string}   'normal' | 'insert' | 'search' | 'command'
 *   searchQuery      {string}   Current search string (/ mode)
 *   commandInput     {string}   Current : command string
 *   isLoading        {boolean}  Whether a heavy operation is in progress
 *   loadingText      {string}   Spinner label
 *   selectedChatIdx  {number}   Index in filteredChats of the highlighted row
 *   showWelcome      {boolean}  Show the getting-started panel in the message area
 *   showHelpPanel    {boolean}  Show the keyboard help panel
 *   qrDisplayContent {string|null} QR login screen content while waiting for scan
 *
 *   --- V2 fields ---
 *   viewMode         {string}   'chat-list' | 'chat-view' | 'split'
 *   splitView        {boolean}  Whether the 30/70 split pane is active (Ctrl+W)
 *   previewChat      {object|null} Chat whose preview popup is shown (Space key)
 *   filterMode       {string}   'all' | 'unread' | 'pinned' | 'groups'
 *   compactMessages  {boolean}  Compact single-line vs. grouped-sender message rendering
 *   startupStep      {string|null} Current startup splash step text
 *   startupDone      {boolean}  Whether startup splash is complete
 */

const state = {
    chats:            [],
    filteredChats:    [],
    currentChatId:    null,
    currentChatTitle: '',
    messages:         [],
    connectionStatus: 'STARTING',
    mode:             'normal',
    searchQuery:      '',
    commandInput:     '',
    isLoading:        true,
    loadingText:      'Starting...',
    selectedChatIdx:  0,
    showWelcome:      false,
    showHelpPanel:    false,
    qrDisplayContent: null,

    // V2
    viewMode:        'chat-list',
    splitView:       false,
    previewChat:     null,
    filterMode:      'all',
    compactMessages: false,
    startupStep:     null,
    startupDone:     false,
};

module.exports = state;
