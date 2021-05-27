//
// Custom control that creates a section for display
//
//  Button  ? (toggles collapsable document fields)
//  TextArea[0]
//  [TextArea[n]]  Optional additional textareas
//  TextArea (collapsable error textarea toggled by content)
//

class section {

    taError;
    button = undefined;
    doc0;
    doc1;
    fields = [];
    values = {};
    id;
    content;
    validators = {};
    next = undefined;

    constructor(id, buttonText, textPlaceHolder, fieldId = "ta" + id) {

        this.id = id;

        // <div class="section">
        const div0 = document.getElementById(id);

        if (buttonText) {
            // <input type="button" ...
            this.button = document.createElement("INPUT");
            this.button.setAttribute("type", "button");
            this.button.value = buttonText || "Button";
            div0.appendChild(this.button);
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

        // <textarea type='text' id="taJWSPayload" placeholder="JWS Payload"></textarea>
        const ta0 = document.createElement("TEXTAREA");
        ta0.setAttribute("id", fieldId);
        ta0.setAttribute("placeholder", textPlaceHolder || id);
        ta0.defaultHeight = "55px";
        content0.appendChild(ta0);
        this.fields.push(ta0);
        this.values[fieldId] = ta0;
        this.validators[fieldId] = [];

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
        this.taError.setAttribute("id", "ta" + id + "Error");
        div03.appendChild(this.taError);

        this.span = span0;

        this.span.addEventListener("click", () => {
            this.span.classList.toggle("active");
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
    //
    //
    addValidator(validator, id) {
        this.validators[id].push(validator);
    }


    errors = {};

    //
    // Sets text in the collapsable Error field. Field will collapse when empty
    //
    setError(message, label = 'default') {
        if (message) {
            this.errors[label] = message;
        } else {
            delete this.errors[label];
        }
        this.displayErrors();
    }

    //
    // Sets text in the collapsable Error field. Field will collapse when empty
    //
    clearError(label) {

        const element = this.taError;

        if (label) {
            delete this.errors[label];
        } else {
            this.errors = {};
        }

        this.displayErrors();
    }

    displayErrors() {

        const element = this.taError;

        const allErrors = [];
        for (const label in this.errors) {
            allErrors.push(this.errors[label]);
        }

        if (allErrors.length === 0) {
            element.value = "";
            element.classList.remove("active");
            element.parentElement.style.maxHeight = null;
            return;
        }

        element.value = allErrors.join('\n');
        element.classList.toggle("active");

        element.parentElement.style.maxHeight = "1px";
        element.parentElement.style.maxHeight = element.scrollHeight + "px";

        setTimeout(() => {
            //element.style.background = '#FFFFFF';
        }, 500);
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
    addTextField(id, placeholder) {

        const ta = document.createElement("TEXTAREA");
        ta.setAttribute("id", id);
        placeholder && ta.setAttribute("placeholder", placeholder);

        const div = document.createElement("DIV");
        div.appendChild(ta);


        //const parent = this.fields[0].parentElement;
        this.fields.push(ta);
        this.values[id] = ta;
        this.validators[id] = []

        this.content.appendChild(div);
    }

    //
    // Gets the value of a field by id or the first field
    //
    getValue(id) {
        return id ? this.values[id].value : this.fields[0].value;
    }


    //
    // Sets the value of a field by id or the first field
    //
    setValue(value, id, color = '#E6F4F1') {

        const element = id ? this.values[id] : this.fields[0];
        element.value = value;

        element.style.height = "1px";
        element.style.height = Math.min((25 + element.scrollHeight), 400) + "px";
        element.style.background = color;

        // Dispatch the 'input' event to trigger validation
        element.dispatchEvent(new Event('input'));

        setTimeout(() => {
            element.style.background = "#FFF";
        }, 500);
    }

    //
    // Clear all fields
    //
    clear() {
        this.clearError();
        for (let i = 0; i < this.fields.length; i++) {
            const element = this.fields[i];
            element.value = "";
            element.style.height = element.defaultHeight || "60px";
        }
    }


    sideBySide(id, placeholder) {

        this.addTextField(id, placeholder);

        this.content.style = "display: flex; max-height: null;";

        this.content.childNodes[0].style = "width: 50%; padding-right: 5px;";
        this.content.childNodes[1].style = "flex-grow: 1; padding-left: 5px;";

    }


    valid() {
        this.fields.forEach(ta => {
            if(!ta.value) return false;
        });
        if(Object.keys(this.errors).length) return false;
        return true;
    }


    goNext() {
        if(!this.next) return;
        setTimeout(() => {
            this.next.button.onclick();
        }, 0);
    }

}



