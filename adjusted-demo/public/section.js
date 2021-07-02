//
// Custom control that creates a section for display
//
//  Button  ? (toggles collapsable document fields)
//  TextArea[0]
//  [TextArea[n]]  Optional additional textareas
//  TextArea (collapsable error textarea toggled by content)
//


class Field {

    section;
    textArea;
    name;
    errors = [];
    height = { min: 60, max: 400 };
    options = { color: { default: "#FFF", update: '#d6fcd7' }, delay: { update: 500, bounce: 500 } };

    constructor(section, name, placeholder) {

        this.section = section;
        this.name = name;
        this.textArea = document.createElement("TEXTAREA");
        this.textArea.setAttribute("placeholder", placeholder);

        const div = document.createElement("DIV");
        div.appendChild(this.textArea);
        section.content.appendChild(div);

        let timer;

        this.textArea.addEventListener('input', () => {

            // this will prevent typing from triggering a server round-trip for every key-stroke
            if (timer) clearTimeout(timer);

            timer = setTimeout(this.update.bind(this), this.options.delay.bounce, timer);

        });
    }

    async update(timer) {

        timer = undefined;

        // Special handling if field is made empty
        // remove errors and clear the remaining sections
        if (this.textArea.value.trim() === '') {
            this.textArea.value = '';
            this.section.fields.length > 1 ?
                this.section.clearErrors(this.index) :
                this.section.clearErrors()
            this.section.next?.clear();
            return;
        }

        await this.section.validate(this);
    }


    set placeholder(text) {
        this.textArea.setAttribute("placeholder", text);
    }

    get index() {
        return this.section.fields.findIndex(e => e === this);
    }

    get value() {
        return this.textArea.value.trim();
    }

    set value(text) {
        this.textArea.value = text || '';
        this.textArea.style.height = "1px";
        this.textArea.style.height = Math.min(Math.max(this.height.min, this.textArea.scrollHeight), this.height.max) + "px";
        if (this.textArea === '') this.errors = [];
        this.textArea.style.background = this.options.color.update;
        setTimeout(() => {
            this.textArea.style.background = this.options.color.default;
        }, this.options.delay.update);
    }

    get errors() {
        return this.errors;
    }

    set errors(errorArray) {
        this.this.errors = errorArray || [];
    }

    valid() {
        return this.value.length && !this.errors.some(err => err.level > 2);
    }

    delete() {
        this.section.content.removeChild(this.textArea.parentElement);
        this.textArea.parentElement.remove();
        this.textArea.remove();
        this.section.fields.splice(this.index, 1);
    }

}



class Section {

    taError;
    button = undefined;
    doc0;
    doc1;
    fields = [];
    id;
    content;
    next = undefined;
    errors = [];


    constructor(id, buttonText) {

        this.id = id;

        // <div class="section">
        const div0 = document.getElementById(id);

        if (buttonText) {
            // <input type="button" ...
            this.button = document.createElement("INPUT");
            this.button.setAttribute("type", "button");
            this.button.value = buttonText || "Button";
            div0.appendChild(this.button);
            //this.button.onclick = async () => await this.process();
            this.button.onclick = this.process.bind(this);
        }

        //<span class="info collapsible"
        const span0 = document.createElement("SPAN");
        span0.className = "info collapsible";
        span0.innerHTML = "&nbsp;&nbsp;?&nbsp;&nbsp;";
        div0.appendChild(span0);

        // <div id="docsDecodeJWS" class="docs"></div>
        const div01 = document.createElement("DIV");
        div01.setAttribute("class", "docs");
        div01.setAttribute("id", "docs" + id);
        div01.style = "display: flex;margin-bottom: 10px;";
        div01.className = "content";
        div0.appendChild(div01);

        //const docHtml = converter.makeHtml(textDoc);
        var div010 = document.createElement('DIV');
        div010.style = "width: 50%;padding-right: 5px;";
        div01.appendChild(div010);

        this.doc0 = document.createElement('article');
        this.doc0.className = "markdown-body";
        this.doc0.innerHTML = "docHtml";
        div010.appendChild(this.doc0);

        var div011 = document.createElement('div');
        div011.style = "flex-grow: 1;padding-left: 5px;";
        div01.appendChild(div011);

        // placeholder for controls
        this.content = document.createElement("DIV");
        div0.appendChild(this.content);

        var content0 = document.createElement("DIV");
        this.content.appendChild(content0);

        // <span class="error collapsible"></span>
        const span1 = document.createElement("SPAN");
        span1.className = "error collapsible";
        div0.appendChild(span1);

        // <div id="docsDecodeJWS" class="docs"></div>
        const div03 = document.createElement("DIV");
        div03.className = "content";
        div0.appendChild(div03);

        //  <textarea class='taError' id="taJWSPayloadError"></textarea>
        this.taError = document.createElement("TEXTAREA");
        this.taError.className = "taError";
        this.taError.readOnly = true;
        this.taError.setAttribute("id", "ta" + id + "Error");
        this.taError.setAttribute("wrap", "off");
        div03.appendChild(this.taError);

        this.span = span0;

        this.span.addEventListener("click", () => {
            //this.span.classList.toggle("active");
            var content = this.span.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });

        return;
    }


    //
    // Sets text in the collapsable Error field. Field will collapse when empty
    // Label allows errors to be put into groups
    //
    setErrors(errors, index = -1) {

        // convert strings to error objects
        for (let i = 0; i < errors.length; i++) {
            if (typeof (errors[i]) === 'string') {
                errors[i] = { message: errors[i], code: 100, level: 3 };
            }
        }

        if (index >= 0) {
            this.fields[index].errors = errors;
        } else {
            this.errors = errors;
        }

        this.displayErrors();

        return errors.length > 0;
    }


    //
    // Sets text in the collapsable Error field. Field will collapse when empty
    // Specify label to clear only errors of that group. Use no label to clear everything
    //
    clearErrors(index = -1) {

        if (index >= 0) {
            this.fields[index].errors = [];
        } else {
            this.errors = [];
            this.fields.forEach(f => f.errors = []);
        }

        this.displayErrors();
    }


    displayErrors() {

        const allErrors = [];
        const errorLabels = ["Debug", "Info", "Warning", "Error", "Fatal"];

        const element = this.taError;
        let errors = false;

        const height = { min: 60, max: 400 };

        this.fields.forEach(f => f.errors.forEach(e => {
            allErrors.push(`· ${e.message} (${errorLabels[e.level]})`);
            errors = errors || e.level > 2;
        }));

        this.errors.forEach(e => {
            allErrors.push(`· ${e.message} (${errorLabels[e.level]})`)
            errors = errors || e.level > 2;
        });

        if (allErrors.length === 0) {
            element.value = "";
            element.parentElement.style.maxHeight = null;
            return;
        }

        element.value = allErrors.join('\n');
        element.style.background = errors ? '#e097a2' : '#f7ca6b';

        // expand the error TA and parent DIV elements
        element.style.height = "1px";
        element.style.maxHeight = height.max + 'px';
        element.style.height = Math.max(element.scrollHeight, height.min) + 5 + 'px';
        element.parentElement.style.maxHeight = 'max-content';
    }


    //
    // Sets the collapsable documentation sections 0-left, 1-right
    // accepts text as markdown and converts it to formatted html
    //
    setDocs(markdownLeft, markdownRight) {

        if (markdownLeft && markdownLeft.trim().length) {
            //doc0 parent style = "width: 50%;padding-right: 5px;";
            this.doc0.innerHTML = markdownLeft;

            if (markdownRight === null) {
                // span left across 100%
                this.doc0.parentElement.style = "width: 100%;";
                const rightDiv = this.doc0.parentElement.nextElementSibling;
                this.doc0.parentElement.parentElement.removeChild(rightDiv);
                return;
            }
        }

        if (markdownRight && markdownRight.trim().length) {

            if (this.doc1 == null) {
                this.doc1 = document.createElement('article');
                this.doc1.className = "markdown-body";
                this.doc0.parentElement.nextElementSibling.appendChild(this.doc1);
            }

            this.doc1.innerHTML = markdownRight;
        }

    }


    //
    // Adds additional text fields below the default text field
    // The new field can be accessed by this.fields[i] or this.values[id]
    //
    addTextField(placeholder, name) {
        this.fields.push(new Field(this, name, placeholder));
    }



    //
    // Reset to single TA
    //
    resetTextFields() {
        for (let i = 1; i < this.fields.length;) {
            this.fields[1].delete();
        }
    }


    //
    // Gets the value of a field by id or the first field
    //
    getValue(index = 0) {
        return this.fields[index].value;
    }


    //
    // Sets the value of a field by id or the first field
    //
    async setValue(value, index = 0) {

        const field = this.fields[index];

        if (!field) throw new Error(`setValue() cannot lookup field[${index}].`);

        field.value = value;

        await field.update();

    }


    //
    // Clear all fields
    //
    clear() {
        this.clearErrors();
        this.fields.forEach(f => f.value = undefined);
        if (this.next) this.next.clear();
    }


    //
    // returns true if each field has data, but there are no errors.
    //
    valid() {
        if (this.fields.some(field => !field.valid())) return false;

        if (this.errors.some(err => err.level > 2)) return false;

        return true;
    }


    //
    // Triggers the button on the next section if .next is assigned
    //
    goNext() {
        if (!this.next) return;

        setTimeout(async () => {
            await this.next.process(); //.button.onclick();
        }, 0);
    }


    //
    // Calls into the overridden process function
    //
    async process() {
        await this.process();
    }



    //
    // Calls into the overridden validate function
    //
    async validate() {
        await this.validate(this.fields[0]);
    }

}
