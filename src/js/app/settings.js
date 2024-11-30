export class Settings {

  constructor(inputs) {
    this.inputs = inputs;
    this.inputs.forEach((el) => {
      const local = localStorage.getItem(el.id);
      if (local) {
        this[el.id] = JSON.parse(local);
      } else {
        if (el.getAttribute("default")) {
          this[el.id] = JSON.parse(el.getAttribute("default"));
        } else if (el.getAttribute("placeholder")) {
          this[el.id] = el.getAttribute("placeholder");
        }
      }
      
      el.addEventListener("change", (e) => {
        this.save(e.target);
      });
    });
  }

  async populateUI() {
    this.inputs.forEach((el) => {
      const local = localStorage.getItem(el.id);
      if (local) {
        this._setValue(el, JSON.parse(local));
      } else {
        if (el.getAttribute("default")) {
          this._setValue(el, JSON.parse(el.getAttribute("default")));
        }
      }
    });
  }

  _setValue(el, value) {
    if (el.value === undefined) {
      if (el.classList.contains("custom-select")) {
        // console.log("Value:", value);
        el.setAttribute("value", el.id + ":" + value);
      } else {
        el.setAttribute("value", value);
      }
    } else {
      if (el.type === "checkbox") {
        el.checked = value;
      } else {
        if (value == -1) {
          el.value = "";
        } else {
          el.value = value;
        }
      }
    }
  }

  _getValue(el) {
    let value;
    if (el.value === undefined) {
      if (el.classList.contains("custom-select")) {
        value = el.getAttribute("value").split(":")[1];
      } else {
        value = el.getAttribute("value");
      }
    } else {
      if (el.type === "checkbox") {
        value = el.checked;
      } else {
        if (el.type === "text" && el.value == "") {
          value = el.getAttribute("placeholder");
          if (!value || value == "") value = el.getAttribute("default");
        } else {
          value = el.value;
        }
      }
    }
    return value;
  }
  
  save(el) {
    this[el.id] = this._getValue(el);
    localStorage.setItem(el.id, JSON.stringify(this._getValue(el)));
  }

  saveAll() {
    this.inputs.forEach((el) => {
      // console.log(this._getValue(el));
      this.save(el);
    });
  }
}
