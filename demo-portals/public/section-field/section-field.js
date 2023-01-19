/*

    +──────────────────────────────DIV.Field─Div─Outer──────────────────────────────────────+
    │                                                                                       │
    │   +──────────────────────────DIV.Field─Div─Label──────────────────────────────────+   │
    │   │       collapsable                                                             │   │
    │   │                                                                               │   │
    │   │   +──────────────────────LABEL.Field─Label────────────────────────────────+   │   │
    │   │   │                                                                       │   │   │
    │   │   +───────────────────────────────────────────────────────────────────────+   │   │
    │   │                                                                               │   │
    │   +───────────────────────────────────────────────────────────────────────────────+   │
    │                                                                                       │
    │   +───────────────────────────DIV.Field─Div─Main──────────────────────────────────+   │
    │   │                                                                               │   │
    │   │   +───────────────────────TEXTAREA.Field─TextArea─Main────────────────────+   │   │
    │   │   │                                                                       │   │   │
    │   │   │                                                +───────ELEMENT──────+ │   │   │
    │   │   │      Absolute positioned child of      ───>    │                    │ │   │   │
    │   │   │      Relative positioned DIV.Field─Div─Main    +────────────────────+ │   │   │
    │   │   │                                                                       │   │   │
    │   │   +───────────────────────────────────────────────────────────────────────+   │   │
    │   │                                                                               │   │
    │   +───────────────────────────────────────────────────────────────────────────────+   │
    │                                                                                       │
    │   +────────────────────────────DIV.Field─Div─Notice───────────────────────────────+   │
    │   │       collapsable                                                             │   │
    │   │                                                                               │   │
    │   │   +────────────────────────TEXTAREA.Field─TextArea─Notice─────────────────+   │   │
    │   │   │                                                                       │   │   │
    │   │   +───────────────────────────────────────────────────────────────────────+   │   │
    │   │                                                                               │   │
    │   +───────────────────────────────────────────────────────────────────────────────+   │
    │                                                                                       │
    +───────────────────────────────────────────────────────────────────────────────────────+

    Style (light-dom):
        Inherited:
            label.color

        background-color:


    Properties:
        value
        label
        errors
     
    Events:
        update
        validation

    Transitions:
    ───────────────────────────────────────────────────────────────────────────────────────
    This control, for cosmetic reasons, transitions the opening and closing of the label and notice areas.
    This means that the control expands from a collapsed state to open over a small amount of time
    This introduces a couple of issues to work around:
    1) having the 'transition' css property on the 'notice-div' results in the transition effect whenever the box 
       is manually resized.  Not what we want.  So we remove the 'transition' property after the transition complete.
    2) the 'transition' will only work if the 'height' of the control is quantified size (e.g. '35px'). 
       Using a height of 'max-content' or some other non-number will prevent the transition.
       However, we want these controls to expand just enough to fit the content (or some max height), so we use 'max-content'.
       To work around this, we do the following:
        1) store the current pixel height of the container 
        2) set the height of the container to 'max-content'
        3) call getComputedStyle() to get the actual new size in pixels
        4) set the height back to the original pixel height in the fist step
        5) call style.height (for no obvious reason) to reset the height or the transition will not work
        6) compute the duration that the transition will take
        7) add the 'transition' property to the containers css
        8) set the container height to the computed height from above to begin the transition
        9) set a setTimeout callback, to the length of the computed transition time, to remove the 'transition' property
       
       we set the height to 'max-content', then we use getComputedStyle() to get the actual 
       pixel height this would be; we set the height to this pixel value; then the transition will occur.

   


*/

const sectionFieldTemplate = document.createElement('TEMPLATE');
sectionFieldTemplate.innerHTML = `
<style>
    /* This refers to the custom control itself within the shadow-dom */
    :host {
        /* default values that can be overridden in the light-dom like this:
            custom-control {
                --background: red;
            }
        */
        --background: white;
        --label-background: gainsboro;
        --notice-background: mistyrose;
        --font-family: Verdana, Geneva, Tahoma, sans-serif;

        font-family: var(--font-family);
        border: 1px solid black;
        border-radius: 5px;
        overflow: hidden;
        display: block;
    }

    :host([hidden]) {
        display: none;
    }

    :host([disabled]) {

    }

    /* the parens are necessary. normally div:focus-within works for a regular element */
    :host(:focus-within) {
        border: 2px solid black;
    }

    .label {
        background-color: var(--label-background);
        display: block;
        font-size: x-small;
        padding: 0.3em 0.5em;
        border-bottom: 1px solid #cccccc;
    }

    textarea {
        box-sizing: border-box;
        width: 100%;
        resize: vertical;
        border: none;
        display: block;
        padding: 0.5em;
        font-size: small;
        font-family: var(--font-family);
    }

    /* remove the default focus outline from the text areas*/
    textarea:focus {
        outline: none;
    }

    .textarea-main:disabled {
        background: #F0F0F0;
    }

    .textarea-main {
        background: var(--background);
    }

    .textarea-notice {
        background-color: transparent;
        overflow-x: hidden;
        border-top: 1px solid #cccccc;
    }

    .transition {
        transition: height 0.5s, background-color 0.5s, color 0.5s ease-out
    }

    .div-element {
        position: absolute;
        border: none;
        padding: 0;
        display: block;
    }

    .div-label {
        /* empty */
        height: 0;
    }

    .div-main {
        position: relative;
    }

    .div-notice {
        /* empty */
        height: 0;
        background-color: var(--notice-background);
    }

</style>

<div class="div-label transition">
    <label id='label' class="label">Label</label>
</div>
<div class="div-main">
    <textarea id='main' class="textarea-main" rows=2></textarea>
    <div id='element' class="div-element"><slot></slot></div>
</div>
<div class="div-notice transition">
    <textarea id='notice' class="textarea-notice" disabled></textarea>
</div>`;


class SectionField extends HTMLElement {

    #element;
    #labelMain;
    #textAreaMain;
    #textAreaNotice;
    #outerDiv;
    #index = 0;
    #errors = [];
    #timer;
    #vertscroll = true;
    #rendered = false;
    #resizeObserver;
    #pattern;
    #previousKeys = {
        value: '',
        cursor: {
            start: 0,
            end: 0
        }
    }
    #previousValue = '';
    #valid = () => {
        return this.#errors.length === 0 && !!this.value;
    }
    #isvalid = false;

    options = {
        color: {
            default: "#FFF",
            update: '#D6FCD7',
            error: '#FCD6D7',
            disabled: '#ACBDCF'
        },
        delay: {
            update: 500,
            bounce: 500,
            dynamic: 4
        },
        optional: false,
        height: {
            main: { min: 30, max: 400 },
            notice: { min: 30, max: 400 }
        }
    };

    static #all = [];
    static debug = false;

    constructor() {
        super();
        log(`CONSTRUCTOR: section-field`);

        const shadowRoot = this.attachShadow({ mode: "open" });
        shadowRoot.appendChild(sectionFieldTemplate.cloneNode(true).content);

        this.#textAreaMain = shadowRoot.getElementById('main');
        this.#textAreaNotice = shadowRoot.getElementById('notice');
        this.#labelMain = shadowRoot.getElementById('label');
        this.#element = shadowRoot.getElementById('element');

        this.#upgradeProperty('label');
        this.#upgradeProperty('notice');
        this.#upgradeProperty('disabled');
        this.#upgradeProperty('readonly');
        this.#upgradeProperty('placeholder');
        this.#upgradeProperty('pattern');

        SectionField.#all.push(this);

        // initialize property defaults here

        // setTimeout(() => {
        //     log(`SETTIMEOUT: (constructor) section-field`);
        //     this.info();
        // }, 0);

        // new MutationObserver((mutations) => {
        //     log(`MUTATIONOBSERVER: attributes`);
        //     this.info();
        // }).observe(this, { attributes: true, childList: false, subtree: false });

        // new MutationObserver((mutations) => {
        //     log(`MutationObserver: children`);
        //     this.info();
        // }).observe(this, { attributes: false, childList: true, subtree: false });

        this.info();
    }

    //#region Web Components

    connectedCallback() {
        // the browser calls this method when an element is added to the document
        // (it can be called many times if an element is added/removed many times)
        log(`CONNECTEDCALLBACK: section-field`);

        const { shadowRoot } = this;

        this.#textAreaMain.addEventListener('beforeinput', this.#before.bind(this));
        this.#textAreaMain.addEventListener('input', this.#input.bind(this));
        this.#textAreaMain.addEventListener('change', this.#change.bind(this));

        this.#textAreaNotice.parentElement.addEventListener('transitionend', (e) => {
            if (e.target.clientHeight > 0) {
                e.target.style.height = 'fit-content';
            }
        });

        this.#labelMain.parentElement.addEventListener('transitionend', (e) => {
            if (e.target.clientHeight > 0) {
                e.target.style.height = 'fit-content';
            }
        });

        this.#resizeObserver = new ResizeObserver(this.#resize.bind(this));
        this.#resizeObserver.observe(this.#textAreaMain);

        shadowRoot.onslotchange = this.#slotChange.bind(this);

        this.info();

        setTimeout(() => {
            log(`SETTIMEOUT: (connectedCallback) section-field`);
            this.info();
        }, 0);

        this.#render();
    }

    disconnectedCallback() {
        // the browser calls this method, when the element is removed from the document
        // (it can be called many times if an element is added/removed many times)
        log(`DISCONNECTEDCALLBACK: section-field`);

        this.#textAreaMain.removeEventListener('beforeinput', this.#before.bind(this));
        this.#textAreaMain.removeEventListener('input', this.#input.bind(this));
        this.#textAreaMain.removeEventListener('change', this.#change.bind(this));
        this.#resizeObserver.disconnect();

        if (this.#pattern) {

        }
    }

    static get observedAttributes() {
        log(`OBSERVEDATTRIBUTES: section-field`);
        return ['value', 'style', 'label', 'notice', 'textContent', 'innerHtml', 'background', 'placeholder', 'disabled', 'readonly', 'pattern'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // called when one of the listed attributes is changed
        log(`ATTRIBUTECHANGEDCALLBACK: section-field name:${name} old:${oldValue} new:${newValue}`);
        this.info();

        const hasValue = newValue !== null;

        switch (name) {

            case 'label':
                this.#label(newValue === "");
                break;

            case 'notice':
                this.#notice(newValue === "");
                break;

            case 'disabled':
                hasValue ?
                    this.#textAreaMain.setAttribute('disabled', '') :
                    this.#textAreaMain.removeAttribute('disabled');
                break;

            case 'readonly':
                hasValue ?
                    this.#textAreaMain.setAttribute('readonly', '') :
                    this.#textAreaMain.removeAttribute('readonly');
                break;

            case 'background-color': {
                this.#textAreaMain.style.backgroundColor = newValue;
                break;
            }

            case 'placeholder': {
                this.#placeholder(newValue);
                break;
            }

            case 'pattern': {
                try {
                    this.#pattern = hasValue ? new RegExp(newValue) : undefined;
                } catch {
                    throw new Error('pattern is not valid regular expression');
                }
                break;
            }

            case 'textContent':
            case 'innerHtml':
            case 'value': {
                this.value = newValue
                break;
            }

            case 'style': {

                const attrib = this.getAttribute('style');

                const [, property, value] = /^([\w-]+):\s*(.+?);$/.exec(newValue);

                switch (property) {

                    case 'border-radius': {
                        this.#outerDiv.style.borderRadius = value;
                        break;
                    }

                    case 'background-color': {
                        const [main, label, notice] = value.split(' ');
                        this.#textAreaMain.style.background = main ?? this.#textAreaMain.style.background;
                        this.#labelMain.style.background = label ?? this.#labelMain.style.background;
                        this.#textAreaNotice.style.background = notice ?? this.#textAreaNotice.style.background;
                        break;
                    }



                    default: { }
                }

                break;

            }


            default: { }
        }
    }

    adoptedCallback() {
        // called once the element is transferred to a new document
        // occurs in document.adoptNode, applied very seldom
        log(`ADOPTEDCALLBACK: section-field`);
    }

    //#endregion


    //#region Static Methods

    labels(enable) {
        SectionField.#all.forEach(f => f.label = enable);
    }

    //#endregion


    //#region Public Properties

    get index() {
        return this.#index;
    }

    set index(index) {
        this.#index = index;
    }

    set valid0(callback) {
        if (typeof callback !== 'function' && typeof callback !== 'undefined') throw new TypeError(`validation must be Function or Undefined`);
        this.#valid = callback;

        // we run the callback immediately so that the current value gets evaluated by the new .valid function
        // TODO: we clear the errors here since our previous errors may be from the previous validation function
        // TODO: we also want to trigger #update with the 
        this.errors = [];
        const result = callback(this);

        if (result instanceof Promise) {
            this.#isvalid = false;
            result.then((r) => {
                this.#isvalid = r;
            });
        } else {
            this.#isvalid = result;
        }
    }

    set valid(callback) {
        if (typeof callback !== 'function' && typeof callback !== 'undefined') throw new TypeError(`validation must be Function or Undefined`);
        this.#valid = callback;
        // update the value to it's current value to trigger the new valid() function
        // we clear #previousValue so that #update will see the value as being new input 
        this.#previousValue = undefined;

        if(this.disabled) return;

        this.#update();
    }

    get valid() {
        return this.#isvalid;
    }

    set disabled(value) {
        Boolean(value) ? this.setAttribute('disabled', '') : this.removeAttribute('disabled');
    }

    get disabled() {
        return this.hasAttribute('disabled');
    }

    set readonly(value) {
        Boolean(value) ? this.setAttribute('readonly', '') : this.removeAttribute('readonly');
    }

    get readonly() {
        return this.hasAttribute('readonly');
    }

    set label(value) {
        Boolean(value) ? this.setAttribute('label', '') : this.removeAttribute('label');
    }

    get label() {
        return this.hasAttribute('label');
    }

    set notice(value) {
        Boolean(value) ? this.setAttribute('notice', '') : this.removeAttribute('notice');
    }

    get notice() {
        return this.hasAttribute('notice');
    }

    set placeholder(value) {
        value == null ? this.removeAttribute('placeholder') : this.setAttribute('placeholder', value.toString());
    }

    get placeholder() {
        return this.getAttribute('placeholder');
    }

    set value(value) {

        this.#textAreaMain && (this.#textAreaMain.value = value?.toString() ?? '');
        this.#update();
    }

    get value() {
        return this.#textAreaMain.value;
    }

    set errors(value) {

        if (value == null) value = [];

        // set a neutral color when no errors
        // set to a min height
        if (value.length === 0) {
            this.#errors = [];
            this.#textAreaNotice.value = '';
            this.#textAreaNotice.parentElement.style.backgroundColor = this.options.color.default;
            this.#noticeResize(this.#textAreaNotice.parentElement);
            return;
        }

        if (!(value instanceof Array) ||
            !value.every(e => typeof e === 'string' || e.message)) {
            throw new TypeError(`parameter must be array of string or {message: string}`);
        }

        // convert string errors to default error type
        this.#errors = value.map(e => typeof e === 'string' ? { message: e, code: 100, level: 3 /*3=Error*/ } : e);

        // put each error on its own line
        this.#textAreaNotice.value = this.#errors.map(e => e.message).join('\n') ?? '';

        // set the background to 'red' if there are errors or 'orange' if just warnings
        this.#textAreaNotice.parentElement.style.backgroundColor = this.#errors.some(e => e.level >= 3) ? '#e097a2' : '#f7ca6b';

        // if any of the errors are 'errors' (level=3) set 'valid' to false
        this.#isvalid = this.errors.every(e => e.level < 3);

        this.#noticeResize(this.#textAreaNotice.parentElement);

        // show the notice
        this.notice = true;
    }

    get errors() {
        return this.#errors;
    }

    set pattern(regex) {
        (regex == null) ? this.removeAttribute('pattern') : this.setAttribute('pattern', regex.toString());
    }

    get pattern() {
        return this.#pattern;
    }

    set isValid(bool) {
        this.#isvalid = Boolean(bool);
    }

    //#endregion


    //#region Events

    #change(_event) {
        log(`change()`);
        this.dispatchEvent(new Event('change'));
    }

    #before(_event) {
        // store the value before input is updated by editing
        this.#previousKeys = {
            value: _event.target.value,
            cursor: {
                start: _event.target.selectionStart,
                end: _event.target.selectionEnd
            }
        }
    }

    #input(_event) {
        // input occurs on each key press or a cut/paste


        // do nothing if the value hasn't changed
        // this occurs if a single char is replaced with the same value
        // or a section is pasted in with the same value
        // if a char is deleted and replaced, this will not stop that
        if (this.#textAreaMain.value === this.#previousKeys.value) return;

        // if we have a pattern and the resulting value after input does not match the pattern
        // set the value to the pre-update value (this.#previousValue is collection in #before event)
        if (this.#pattern) {
            const input = this.#textAreaMain.value;
            if (this.#pattern.test(input) === false) {
                this.#textAreaMain.value = this.#previousKeys.value;
                this.#textAreaMain.selectionStart = this.#previousKeys.cursor.start;
                this.#textAreaMain.selectionEnd = this.#previousKeys.cursor.end;
                return;
            }
        }

        // this will prevent typing from triggering a server round-trip for every key-stroke
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = setTimeout(
            function () {
                this.#update();
            }.bind(this), this.options.delay.bounce);
    }

    #slotChange(_event) {
        let slots = this.shadowRoot.querySelectorAll('slot');
        log(`SLOTCHANGE: section-field children:${slots[0].assignedNodes.length}`);
        this.info();
        this.#children();
    }

    // whenever the Main textarea is resized, check if the vertical-scrollbar
    // appears/disappears and reposition the optional Element (if present)
    // NOTE: We rely on this to happen for the initial control sizing since nothing is rendered
    // when first constructed. This occurs after the widths/heights are computed
    #resize(entries) {
        log(`RESIZEOBSERVER: `);
        const { target } = entries.pop();
        const vertScrollToggle = this.#vertscroll !== (target.clientHeight < target.scrollHeight);

        this.info();

        if (vertScrollToggle) {
            log(`verticalScroll:${this.#vertscroll}`);
            this.#positionElement();
            this.#vertscroll = !this.#vertscroll;
        }
    }

    //#endregion


    //#region Attribute Change Handlers

    #label(show) {

        const div = this.#labelMain.parentElement;

        if (Boolean(show)) {
            // have at least one character in the label to compute its proper height
            if (!this.#labelMain.innerHTML == null) this.#labelMain.innerHTML = " ";
            this.#expand(div);
            //this.#noticeResize(div);
            this.#textAreaMain.placeholder = '';
        } else {
            this.#collapse(div);
            this.#textAreaMain.placeholder = this.placeholder ?? '';
        }

    }

    #notice(show) {

        const div = this.#textAreaNotice.parentElement;

        if (Boolean(show)) {
            this.#resizeTextArea(this.#textAreaNotice, this.options.height.notice.min, this.options.height.notice.max);
            //this.#expand(div);
            this.#noticeResize(div);
        } else {
            this.#collapse(div);
        }

    }

    #placeholder(value) {
        this.#labelMain.innerText = value ?? " ";
        this.#textAreaMain.placeholder = this.label ? "" : (value ?? "");
    }

    //#endregion


    //#region Public Methods

    // Clears the field
    clear() {
        this.#textAreaMain.value = '';
        this.#previousKeys = {
            value: '',
            cursor: {
                start: 0,
                end: 0
            }
        }
        this.#previousValue = '';
        this.#textAreaNotice.value = '';
        this.#errors = [];
        this.#isvalid = false;

        this.#noticeResize(this.#textAreaNotice.parentElement);
        this.#resizeTextArea(this.#textAreaMain, this.options.height.main.min, this.options.height.main.max);
    }

    //#endregion

    // 'upgrade' is the process of this object transforming from an unknown html tag to this custom
    // web component.  Existing properties will override the class properties
    #upgradeProperty(prop) {
        if (this.hasOwnProperty(prop)) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }


    #render(_event) {
        log(`render ${[...this.childNodes].length}`);
        this.#rendered = true;
        this.#textAreaMain.rows = 1;
        this.options.height.notice.min = this.#textAreaMain.clientHeight;
        this.#textAreaMain.rows = 2;
        this.options.height.main.min = this.#textAreaMain.clientHeight;
    }


    #children(_event) {
        // make margin adjustments to accommodate the child element(s)
        this.#positionElement();
    }


    // Internal update method when data is entered into the textAreaMain
    // This gets called after every input update
    #update() {

        // do nothing if the value hasn't changed
        // such as pasting or typing over the existing value with the same value
        if (this.#textAreaMain.value === this.#previousValue) return;

        // if only whitespace, clear the Field
        if (this.value.trim() === '') {
            //this.clear();
        }

        // store the new value as the previous value
        this.#previousValue = this.#textAreaMain.value;

        // resizes the textArea based on its content height within a min-max
        this.#resizeTextArea(this.#textAreaMain, this.options.height.main.min, this.options.height.main.max);

        // call the validation callback, if assigned
        if (this.#valid) {

            // TEMP1:
            // clear errors before valid() call
            this.errors = [];
            const isValid = this.#valid(this);

            const sendEvent = (valid) => {
                this.#isvalid = valid;

                // clear the errors when valid - this prevents the valid function from being required to clear the errors
                // the downside is that we cannot have errors and valid===true at the same time
                // something we might want to do for purely optional fields with bad syntax
                //if (valid) this.errors = [];

                // TODO: we're not clearing errors on valid now.  
                //   This resulted in warnings also being cleared when there were no errors (level 3)
                //   If we auto-clear just level-3 errors then the caller will have to explicitly clear warnings
                //
                // What if we always auto-clear errors at before field.valid?  See TEMP1:
                // We would always get fresh errors but could not accumulate errors over each evaluation.  Would we ever want that?

                let evt = new Event(valid ? 'valid' : 'invalid');
                evt.data = valid ? this : this.errors;
                this.dispatchEvent(evt);

                evt = new Event('update');
                evt.data = this;
                this.dispatchEvent(evt);
            }

            if (isValid instanceof Promise) {
                isValid.then(sendEvent);
            } else {
                sendEvent(isValid);
            }

        } else {
            const evt = new Event('update');
            evt.data = this;
            this.dispatchEvent(evt);
        }

    }


    #expand(div) {

        if (div.style.height === 'fit-content') return;

        // we assume the height is initially at 0px

        // set to fit its content
        div.style.height = 'fit-content';

        // the resizing below is to allow a cosmetic transition
        // this will do nothing if the component is not yet rendered
        if (this.#rendered === false) return;

        // compute that height in pixels
        const pxHeight = window.getComputedStyle(div).height;

        // reset the height to zero, or we won't transition from 0->pxHeight
        div.style.height = '0px';

        // force reflow since we already updated the height to 'fit-content'
        div.offsetHeight;

        // set the new height in pixels (or we wont' get a transition)
        div.style.height = pxHeight;

        // a transitionend event in connectedCallback will set the expanded div.height back to 'fit-content'

    }

    // Resizes the notice-textarea and notice-div with transition
    #noticeResize(div) {

        // the resizing below is to allow a cosmetic transition
        // this will do nothing if the component is not yet rendered
        if (this.#rendered === false) return;

        // get current height in pixels
        const pxCurrentHeight = window.getComputedStyle(div).height;

        // set the notice textarea to the correct height
        this.#resizeTextArea(this.#textAreaNotice, this.options.height.notice.min, this.options.height.notice.max);

        // set to fit its content
        div.style.height = 'fit-content';

        // compute the new height in pixels
        const pxNewHeight = this.#errors.length ? window.getComputedStyle(div).height : '0px'

        // reset the height 
        div.style.height = pxCurrentHeight;

        // force reflow since we already updated the height to 'fit-content'
        div.offsetHeight;

        // set the new height in pixels (or we wont' get a transition)
        div.style.height = pxNewHeight;

        // a transitionend event in connectedCallback will set the expanded div.height back to 'fit-content'

    }


    #collapse(div) {

        if (this.#rendered) {

            // set the height to actual pixels so that transition can occur
            div.style.height = window.getComputedStyle(div).height;

            // force reflow since we already updated the height to 'fit-content'
            div.offsetHeight;

        }

        // reset the height to zero, or we won't transition from 0->pxHeight
        div.style.height = '0px';
    }


    #resizeTextArea = (textArea, min, max) => {
        const currentHeight = textArea.style.height || "1px";
        textArea.style.height = "1px";
        const newHeight = `${Math.min(Math.max(min, textArea.scrollHeight + 1), max)}px`;
        textArea.style.height = currentHeight;
        textArea.style.height = newHeight;
    }


    removeChild(node /*HTMLButtonElement*/) {
        log(`removeChild ${node}`);
        super.removeChild(node);
        this.#positionElement();
        return node;
    }

    //#endregion

    #positionElement() {

        const element = this.#element;

        if (!element) return;

        const taMain = this.#textAreaMain;

        // compute the absolute position of the DIV element
        // we intentionally are using paddingLeft (assuming it is the same as right) 
        // because we will modify paddingRight below
        const padRight = window.getComputedStyle(taMain).paddingLeft;
        const padTop = window.getComputedStyle(taMain).paddingTop;
        const vertScrollWidth = (taMain.offsetWidth - taMain.clientWidth)
        element.style.top = padTop;
        element.style.right = (pxToFloat(padRight) + vertScrollWidth) + 'px';

        // compute the right padding of the TA 
        taMain.style.paddingRight = (pxToFloat(padRight) + 2 + element.clientWidth) + 'px';

        // compute the min-height of the TA so that the optional Element is always visible
        const padBottom = window.getComputedStyle(taMain).paddingBottom;
        taMain.style.minHeight = Math.max(
            this.options.height.main.min,
            (pxToFloat(padTop) + pxToFloat(padBottom) + element.clientHeight)
        ) + 'px';

        // if the computed min-height is greater than options.height.min
        // set options.height.min to this height as we don't want to allow 
        // going smaller
        if (pxToFloat(taMain.style.minHeight) > this.options.height.main.min) {
            // this.options.height.min = pxToFloat(taMain.style.minHeight);
        }

    };


    //#region Debug

    // debug function for displaying state as sequence of instantiation events occurs
    info() {
        log(`-- children: ${this.childNodes.length}`);
        log(`-- attributes: ${this.attributes.length}`);
        const style = window.getComputedStyle(this.#textAreaMain);
        log(`-- getComputedStyle: ${style.height !== ''}`);
    }

    //#endregion

}

//export default CustomField;

// debug logging when static SectionField.debug === true
function log(text) {
    if (SectionField.debug) {
        console.debug(text);
    }
}

function pxToFloat(px) {
    return parseFloat(px.replace('px', ''));
}

customElements.whenDefined('section-field').then((_e) => {
    log('WHENDEFINED section-field');
});

customElements.define("section-field", SectionField);
