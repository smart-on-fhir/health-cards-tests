# Section _\<custom-section>_
### Web Component

This custom web component that is a collection of one or more section-fields.

<br>  

## Contents  
[Instantiation](#instantiation)  
[Customization](#customize)    
[Events](#events)  
[Properties](#properties)  
[Attributes](#attributes-html)  
[Event Flow](#event-flow)  


<br><br>
## Instantiation
How to create new instances of this control  

```html
<!-- include the control in HTML -->
<head>
    <script src='section.js' [type='module']></script>
</head>
```

```html
<!-- create in HTML -->
<custom-section></custom-section>
```

```js
// or create with JavaScript
const field = document.createElement('custom-section');
<some-element>.appendChild(field);
```

<br><br>
## Customize
Customized the appearance and functionality of this control  

### __style__

```html
<!-- The control's style is encapsulated with a shadow-dom. 
     However, some css styles can be defined in the 'light-dom' -->
<style>
    custom-section {
       
    }
</style>
```


<br><br>
## Properties
Properties accessible through JavaScript

### `value`
```js
// get: returns the 'value' of the section (defined by the 'value' function)
const value = section.value;

// set: sets the 'value' function of the control.
// If not specified the value will be the text of the 1st field
section.value = (section) => {
    return section.fields[0].value.toUpperCase();
}
```

### `valid`
```js
// get: returns the result of the section.valid function
const isValid = section.valid;
// or, if valid() returns a promise
const isValid = await section.valid;

// set: sets the 'valid' function of the control. The valid function must return a boolean or Promise<boolean>
section.valid = (section) => {
    return section.fields[0].value === 'Hello';
}
```

### `initialize`
```js
// set: sets the 'initialize' function of the control.
section.initialize = (section) => {
    const first = section.addField('First Name');
    first.value = "Joe Smith";
}
```

### `fields`
```js
// returns a read-only array of fields
const fields = section.fields;
```

### `errors`
```js
// get: returns an array of Errors. An empty array will be returned when there are no errors
const errors = sections.errors

// set: sets the error array
section.errors = ['Last Name cannot be empty']
```

### `docs`
```js
// set: sets the documentation section(s) as markdown text. Replaces previous docs.
section.docs = ['#Instructions ...', '#Additional Info...']
```

### `readonly`
```js
// set: when true, the text data cannot be altered by the user
section.readonly = true;
```

### `disabled`
```js
// set: when true, the control cannot be interacted with
section.disabled = true;
```



<br><br>
## Attributes
Attributes accessible through HTML

### `readonly` 
```html
<!-- prevent text from being manually edited -->
<custom-section readonly/><custom-section>
```

### `disabled` 
```html
<!-- the control will be visible, but fully disabled -->
<custom-section disabled/><custom-section>
```


<br><br>
## Methods

### `addField(placeholder?: string)`
```js
// add a new field to the section
section.addField('Last Name');
```

### `removeField(field: section-field)`
```js
// removes a field from the section by reference or by index
section.removeField(field);
```

### `clear()`
```js
// clears the values of each field
section.clear() : void;
```

### `initialize()`
```js
// sets up the section control for first use
section.initialize() : void;
```

### `valid()`
```js
// determines if the section is valid
section.initialize() : boolean;
```

<br><br>
## Events

### `update`
```js
// triggered when any of its section-fields are updated
section.attachEventListener('update', (section)=>{ /* do stuff*/ })
```

<br><br>
## Event Flow

The flow and control of functions and events.  
Solid lines denote direct function calls while dotted-lines denote the flow progressing though an event.  

</br></br>

<div style='border: 1px solid white;text-align:center;min-height:1em;padding:1em'>
    <span>CUSTOM-SECTION</span>
    </br></br>
    <div style='border: 1px solid yellow;text-align:center;min-height:1em'>
        <span>SPAN.title</span>
    </div>
    </br>
    <div style='border: 1px solid blue;text-align:center;min-height:1em'>
        <span>SPAN.title</span>
    </div>
    </br>
</div>
