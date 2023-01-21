/*  CUSTOM-SECTION HTML layout

    ╭────────────────────────────────── DIV.container ──────────────────────────────────────+
    │                                                                                       │
    │   ╭──────────────────────────────── SPAN.title ───────────────────────────────────╮   │
    │   │                                                                               │   │
    │   ╰───────────────────────────────────────────────────────────────────────────────╯   │
    │                                                                                       │
    │   ╭────────────── INPUT.button ──────────╮   ╭────────────── SPAN.? ──────────────╮   │
    │   │   optional                           │   │                                    │   │
    │   ╰──────────────────────────────────────╯   ╰────────────────────────────────────╯   │
    │                                                                                       │
    │   ╭──────────────────────────────────── DIV.docs ─────────────────────────────────╮   │
    │   ↑   collapsable                                                                 ↓   │
    │   ↑                                                                               ↓   │
    │   ↑   ╭─────────────ARTICLE.0────────────╮   ╭─────────────ARTICLE.n────────────╮ ↓   │
    │   ↑   │                                  │...│                                  │ ↓   │
    │   ↑   ╰──────────────────────────────────╯   ╰──────────────────────────────────╯ ↓   │
    │   ↑                                                                               ↓   │
    │   ╰───────────────────────────────────────────────────────────────────────────────╯   │
    │                                                                                       │
    │   ╭────────────────────────────────────DIV.content────────────────────────────────╮   │
    │   │                                                                               │   │
    │   │   ╭───────────────────────────────────SLOT────────────────────────────────╮   │   │
    │   │   │                                                                       │   │   │
    │   │   │   ╭───────────────────────────SECTION-FIELD.0───────────────────────╮ │   │   │
    │   │   │   │                                                                 │ │   │   │
    │   │   │   ╰─────────────────────────────────────────────────────────────────╯ │   │   │
    │   │   │                                   ...                                 │   │   │
    │   │   │   ╭───────────────────────────SECTION-FIELD.n───────────────────────╮ │   │   │
    │   │   │   │                                                                 │ │   │   │
    │   │   │   ╰─────────────────────────────────────────────────────────────────╯ │   │   │
    │   │   │                                                                       │   │   │
    │   │   ╰───────────────────────────────────────────────────────────────────────╯   │   │
    │   │                                                                               │   │
    │   ╰───────────────────────────────────────────────────────────────────────────────╯   │
    │                                                                                       │
    │   ╭──────────────────────────────── SPAN.error ───────────────────────────────────╮   │
    │   │                                      what is this for?                        │   │
    │   ╰───────────────────────────────────────────────────────────────────────────────╯   │
    │                                                                                       │
    │   ╭─────────────────────────────── DIV.content ───────────────────────────────────╮   │
    │   ↑   collapsable                                                                 ↓   │
    │   ↑                                                                               ↓   │
    │   ↑   ╭────────────────────────TEXTAREA.taError───────────────────────────────╮   ↓   │
    │   ↑   │                                                                       │   ↓   │
    │   ↑   ╰───────────────────────────────────────────────────────────────────────╯   ↓   │
    │   ↑                                                                               ↓   │
    │   ╰───────────────────────────────────────────────────────────────────────────────╯   │
    │                                                                                       │
    │   ╭──────────────────────────────── DIV.progress──────────────────────────────────╮   │
    │   ⭡                                                                               ↓   │
    │   ╰───────────────────────────────────────────────────────────────────────────────╯   │
    │                                                                                       │
    ╰───────────────────────────────────────────────────────────────────────────────────────╯

    */

const sectionTemplate = document.createElement('TEMPLATE');
sectionTemplate.innerHTML = `
<link rel="stylesheet" href="../github-markdown.css">
<style>

    div {
        border-color: gray;
        border-style: unset;
        border-width: 0px;
    }

    label {
        color: white;
        display: inline-block;
        font-family: "Open Sans";
        font-size: 16px;
        padding: 0px 0px;
        text-align: center;
        text-decoration: none;
    }

    input[type="button"] {
        background-color: #6b7987;
        border-radius: 3px;
        border: 1px solid black;
        color: white;
        display: inline-block;
        font-size: 16px;
        margin-bottom: 5px;
        padding: 15px 32px;
        text-align: center;
        text-decoration: none;
        width: 300px;
    }

    img {
        border: 1px solid black;
        height: 300px;
        width: 300px;
        margin-right: 5px;
    }

    textarea,
    article,
    select.combo,
    input[type="text"] {
        border-radius: 3px;
        border: 1px solid black;
        box-sizing: border-box;
        height: 100%;
        margin-bottom: 5px;
        padding: 10px;
        resize: vertical;
        transition: background-color 0.5s ease;
        width: 100%;
        display: block;
    }

    select.combo {
        resize: unset;
        height: unset;
        color: white;
        background-color: #6b7987;
        filter: drop-shadow(6px 6px 6px #404040);
    }

    option {
        padding: 5px;
    }

    progress {
        width: 100%;
    }

    .taError {
        overflow-x: auto;
        overflow-wrap: normal;
    }

    article {
        background-color: #f1f1e6be;
    }

    .collapsible:hover {
        background-color: #555;
    }

    .docs {
        display: flex; 
        margin-bottom: 0.5em; 
        gap: 0.5em;
    }

    .content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.2s ease-out;
    }

    .footer {
        bottom: 0;
        color: white;
        left: 0;
        position: fixed;
        text-align: center;
        width: 100%;
    }

    #CenterDIV {
        background-color: rgba(255, 255, 255, 0.75);
        display: none;
        height: 100%;
        left: 0;
        padding-top: 100px;
        position: fixed;
        top: 0;
        width: 100%;
    }

    .divFloat {
        background-color: #fff;
        border: solid 1px #999;
        border-radius: 3px;
        box-shadow: 0 4px 23px 5px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15);
        color: #000;
        display: block;
        height: auto;
        margin: 0 auto;
        padding: 20px;
        transition: 200ms -webkit-transform;
        webkit-box-orient: vertical;
        width: 600px;
    }

    .info {
        color: #acbdcf;
        cursor: pointer;
        font-family: "Open Sans";
        font-weight: bold;
    }

    .section {
        padding-bottom: 100px;
    }

    .issues {
        visibility: hidden;
    }

    .unscannedPart {
        color: #acbdcf;
    }

    .scannedPart {
        color: aqua;
        font-weight: bold;
    }

    #span-issuer-label {
        font-family: "Open Sans";
        top: 15px;
        margin-left: 10px;
        color: white;
        font-size: 16px;
        position: absolute;
    }

    #profile-select {
        font-family: "Open Sans";
        font-size: 16px;
        padding: 10px;
        border-radius: 3px;
        border: solid 1px black;
        background-color: #6b7987;
        color: white;
        display: inline-block;
        text-decoration: none;
        width: 300px;
        text-align-last: center;
    }

    #button {
        display: none;
    }

    #title {
        color: white;
        font-family: "Open Sans";
        font-size: 20px;
        font-weight: bold;
    }
</style>

<div id="container">
    <span id="title">Title</span>
    <input id="button" type="button" style="display: none"></input>
    <span id="span" class="info collapsible">&nbsp;&nbsp;?&nbsp;&nbsp;</span>
    <div id="docs" class="docs content"></div>
    <div id="content">
        <slot></slot>
    </div>
    <span class="error collapsible"></span>
    <div class="content">
        <textarea id="taError" class="taError" wrap="off"></textarea>
    </div>
    <div class="progress"></div>
</div>
`;

class CustomSection extends HTMLElement {

    #taError;
    #button = undefined;
    doc0;
    doc1;
    fields = [];
    id;
    #content;
    next = undefined;
    #errors = [];
    #disabled = false;
    #progress;
    #container;
    #docs = [];
    #span;
    #rendered = false;
    #isValid = false;
    #slotted = new WeakSet();

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: "open" });
        shadowRoot.appendChild(sectionTemplate.cloneNode(true).content);

        this.#content = shadowRoot.getElementById('content');
        this.#button = shadowRoot.getElementById('button');
        this.#span = shadowRoot.getElementById('span');
        this.#taError = shadowRoot.getElementById('taError');
        this.#container = shadowRoot.getElementById('container');

        this.#upgradeProperty('button');
        this.#upgradeProperty('placeholder');

        // put 'add' and 'remove' method on fields array to allow section.fields.add('my field label')
        this.fields.add = this.addTextField.bind(this);
        this.fields.remove = this.removeTextField.bind(this);
    }

    connectedCallback() {

        //the browser calls this method when an element is added to the document
        // (it can be called many times if an element is added/removed many times)
        console.debug(`connectedCallback arguments:${JSON.stringify(arguments)}`);

        const { shadowRoot } = this;

        // wire events 

        this.#span.addEventListener("click", () => {
            var content = this.#span.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });

        this.#button?.addEventListener("click", () => {
            this.#initialize.bind(this)();
        });

        shadowRoot.onslotchange = this.#slotChange.bind(this);

    }

    disconnectedCallback() {
        // the browser calls this method, when the element is removed from the document
        // (it can be called many times if an element is added/removed many times)
        console.debug(`disconnectedCallback`);
    }

    static get observedAttributes() {
        console.debug(`observedAttributes()`);
        return ['button', 'style', 'title'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // called when one of the listed attributes is changed
        console.debug(`attributeChangedCallback name:${name} old:${oldValue} new:${newValue}`);

        switch (name) {

            case 'button': {
                this.button = newValue;
                break;
            }

            case 'title': {
                this.shadowRoot.getElementById('title').innerHTML = newValue ?? '';
                break;
            }

            case 'style': {
                break;
            }

            default: { }

        }
    }

    adoptedCallback() {
        // called once the element is transferred to a new document
        // occurs in document.adoptNode
        console.debug(`adoptedCallback()`);
    }

    #slotChange(_event) {
        let slots = this.shadowRoot.querySelectorAll('slot');
        console.log(`section: slotchange children:${slots[0].assignedNodes.length}`);
        if (!this.#rendered) {
            this.#render();
            this.#rendered = true;
        }
        this.#children(this.childNodes);
    }

    #children(nodes) {

        nodes.forEach(node => {

            if (!this.#slotted.has(node)) {

                switch (node.nodeName) {

                    case "DOC":
                        this.docs = this.docs.concat([node.innerHTML]);
                        node.style.display = 'none';
                        break;

                    case "SECTION-FIELD":
                        this.#addField(node);
                        break;

                    default:
                }

                // mark the nodes as slotchange can get called many times
                // and the event gives no clue what nodes are new
                this.#slotted.add(node);
            }

        })

    }

    #fieldUpdate(event) {

        const field = event.target;

        const result = this.#update(field);


        const dispatch = function (result) {
            const evt = new Event(result ? 'valid' : 'invalid');
            evt.data = this.section;
            this.section.#isValid = result;
            this.section.dispatchEvent(evt);
        }.bind({
            section: this,
            field: field.placeholder,
            value: field.value
        });

        // if #update is an async function, wait for it to resolve
        result instanceof Promise ?
            result.then(dispatch) :
            dispatch(result);
    }

    #render(_event) {
        console.log(`render ${[...this.childNodes].length}`);
    }

    #upgradeProperty(prop) {
        if (this.hasOwnProperty(prop)) {
            let value = this[prop];
            delete this[prop];
            this[prop] = value;
        }
    }

    #displayErrors() {

        const allErrors = [];
        const errorLabels = ["Debug", "Info", "Warning", "Error", "Fatal"];

        const element = this.#taError;
        let errors = false;

        this.#errors.forEach(e => {
            allErrors.push(`· ${e.message} (${errorLabels[e.level]})`)
            errors = errors || e.level > 2;
        });

        if (allErrors.length === 0) {
            this.#showErrors(false);
            return;
        }

        element.value = allErrors.join('\n');
        element.style.background = errors ? '#e097a2' : '#f7ca6b';

        this.#showErrors(true);
    }

    #showErrors(show) {

        const element = this.#taError;

        const height = { min: 60, max: 400 };

        if (!!show) {
            element.style.height = "1px";
            element.style.maxHeight = height.max + 'px';
            element.style.height = Math.max(element.scrollHeight, height.min) + 5 + 'px';
            element.parentElement.style.maxHeight = 'max-content';
        } else {
            element.value = "";
            element.parentElement.style.maxHeight = null;
        }

    }

    #addField = (node) => {

        // if we already know about this field, do nothing
        // this happens when we programmatically add a field and the slot change event fires
        // we don't know if the slot change node is new, or not, and send it here
        if (this.fields.includes(node)) return;

        // field could already be a child when defined in html or assigned through DOM
        if (!this.contains(node)) this.appendChild(node);

        // wire an 'update' event whenever the field changes value
        node.addEventListener('update', this.#fieldUpdate.bind(this));

        node.index = this.fields.length;
        this.fields.push(node);
    }

    #removeField = (node) => {
        this.removeChild(node);
        this.fields.splice(this.fields.indexOf(node), 1);
    }

    // default initialize method
    #initialize = () => {
        return;
    };

    // default value getter
    #value = () => {
        return this.fields?.[0].value;
    }

    // default update handler
    #update = (field) => {
        // TODO: should the default be 
        // return this.fields.every(f => f.valid);
        return true;
    }

    // default clear() method
    #clear = (section) => {
        this.errors = [];
        this.fields.forEach(f => f.clear());
        return false;
    }

    //
    // Sets the collapsable documentation sections
    // accepts text as markdown and converts it to formatted html
    //
    #appendDoc(markdown) {

        // parent container
        const docs = this.shadowRoot.getElementById('docs');

        if (markdown.trim().length) {

            var div = document.createElement('DIV');
            div.style.flexGrow = "1";
            docs.appendChild(div);

            const doc = document.createElement('ARTICLE');
            doc.className = "markdown-body";
            doc.innerHTML = markdown;
            div.appendChild(doc);
        }

    }

    //
    // Adds additional text fields below the default text field
    // The new field can be accessed by this.fields[i] or this.values[id]
    //
    addTextField(placeholder) {
        const field = document.createElement('section-field');
        field.placeholder = placeholder;
        this.#addField(field);
        return field;
    }

    removeTextField(field) {
        if (field.nodeName !== 'SECTION-FIELD') {
            throw new TypeError(`field not a 'SECTION-FIELD'`);
        }
        this.#removeField(field);
    }

    addComboBox(placeholder, items) {
        if (this.#disabled) return;
        const combo = new ComboBox(items);
        //const field = new CustomField(this, placeholder, combo.input);
        field.value = '';
        this.fields.push(field);
    }

    get docs() {
        return this.#docs;
    }

    set docs(markdownArray) {

        if (typeof showdown === 'undefined') {
            throw new ReferenceError('showdown converter not found');
        }

        if (!(markdownArray instanceof Array) ||
            !markdownArray.every(e => typeof e === 'string')) {
            throw new TypeError('docs: parameter must be string array');
        }

        this.#docs = markdownArray.slice();

        const docs = this.shadowRoot.getElementById('docs');

        // clear existing docs
        let doc = docs.lastElementChild;
        while (doc) {
            docs.removeChild(doc);
            doc = docs.lastElementChild;
        }

        const converter = new showdown.Converter();

        markdownArray.forEach(mdText => {
            const content = stripIndent(mdText);
            const html = converter.makeHtml(content);
            this.#appendDoc(html);
        });

    }

    set button(text) {
        if (text == null) {
            this.#button.style.display = 'none';
            return;
        }
        this.#button.value = text;
        this.#button.style.display = 'inline-block';
    }

    get button() {
        return this.#button.value;
    }

    set title(text) {
        this.setAttribute('title', 'text');
    }

    get title() {
        return this.getAttribute('title');
    }

    set disabled(state) {
        // Enable/Disable the section and all children
        this.#disabled = !!state;
        this.fields.forEach(field => field.disabled = !!state);
        if (this.next) this.next.disabled = !!state;
    }

    get disabled() {
        return this.#disabled;
    }

    set errors(errorArray) {

        if (!(errorArray instanceof Array) || !errorArray.every(e => typeof e === 'string')) {
            // throw new TypeError(`parameter must by a string array`);
            // TODO: inspect for Error type eg '{ message: err, code: 100, level: 3 };'
        }

        this.#errors = errorArray.map(err => {
            if (typeof err === 'string') {
                return { message: err, code: 100, level: 3 };
            }
            return err;
        });

        this.#displayErrors();

    }

    get errors() {
        return this.#errors;
    }

    set initialize(asyncCallback) {
        const f = asyncCallback.bind(this);
        this.#initialize = () => {
            // TODO: any before or after bookkeeping here?
            return f(...arguments);
        }
    }

    get initialize() {
        return this.#initialize;
    }

    get valid() {
        return this.#isValid;
    }

    set update(callback) {
        this.#update = callback;
    }

    get update() {
        return this.#update;
    }

    set value(callback) {
        this.#value = callback;
    }

    get value() {
        return this.#value(this);
    }

    set clear(callback) {
        this.#clear = callback.bind(this);
    }

    get clear() {
        // this getter returns a function
        // so the call looks like are regular function call
        // section.clear()  // section.clear gets the function, then () calls it.
        if (this.#disabled) return;

        return async function () {
            const valid = this.#clear(this);
            const evt = new Event(valid === true ? 'valid' : 'invalid');
            evt.data = this;
            this.#isValid = valid === valid;
            this.dispatchEvent(evt);
        }.bind(this);
    }

    //
    // Sets progress bar
    // 
    // progress(enabled, label = '', percent = undefined) {
    //     this.#progress.label = label;
    //     this.#progress.percent = percent;
    //     this.#progress.hidden = !enabled;
    // }


    //
    // Sets text in the collapsable Error field. Field will collapse when empty
    // Label allows errors to be put into groups
    //
    // setErrors(errors, index = -1) {
    //     if (this.#disabled) return;
    //     // convert strings to error objects
    //     for (let i = 0; i < errors.length; i++) {
    //         if (typeof (errors[i]) === 'string') {
    //             errors[i] = { message: errors[i], code: 100, level: 3 };
    //         }
    //     }

    //     if (index >= 0) {
    //         this.fields[index].errors = errors;
    //     } else {
    //         this.#errors = errors;
    //     }

    //     this.#displayErrors();

    //     return errors.length > 0;
    // }

    //
    // Sets text in the collapsable Error field. Field will collapse when empty
    // Specify label to clear only errors of that group. Use no label to clear everything
    //
    // clearErrors(index = -1) {
    //     if (this.#disabled) return;
    //     if (index >= 0) {
    //         this.fields[index].errors = [];
    //     } else {
    //         this.#errors = [];
    //         this.fields.forEach(f => f.errors = []);
    //     }

    //     this.#displayErrors();
    // }

}

function stripIndent(multiLineText) {
    /* 
        Removes indenting from html formatting
        by finding the leftmost non-whitespace line and using that as
        the left-edge of the content, stripping the whitespace to the left
    */

    multiLineText = multiLineText.replace(/^[^\S]*<!--/, '').replace(/-->[^\S]*$/, '');

    const indentedLinesMatches = [...multiLineText.matchAll(/^([^\S\n\r]*)\S/gm)];

    const indentLengths = indentedLinesMatches.map(arr => arr[1].length);

    // find the minimum indent for non-empty lines
    const minIndent = Math.min(...indentLengths);

    // replace the this indent from each line
    const rx = new RegExp(`^[^\S\n\r]{${minIndent}}`);
    const lines = multiLineText.split('\n').map(line => line.replace(rx, ''));

    return lines.join('\n');
}

customElements.define("custom-section", CustomSection);
