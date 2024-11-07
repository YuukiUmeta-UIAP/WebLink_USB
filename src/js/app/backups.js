function drawDownloadIcon() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" /></svg>'
}

function drawRemoveIcon() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox=".445 1190.775 24 24"><path d="M19.445 1194.775h-3.5l-1-1h-5l-1 1h-3.5v2h14M6.445 1197.775h12v14h-12z"/></svg>'
}

export class Backups {
  constructor(div, len, callbacks) {
    this.div = div;
    this.length = len;
    this.backups = new Array();
    this.callbacks = callbacks;
    // console.log(this.div);
  }

  populate() {
    let pos = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i).slice(0, 6) == "backup") {
        this.backups[pos] = localStorage.key(i);
        pos++;
      }
    }
    this.backups.sort().reverse();
    if (this.backups.length > this.length) {
      for (let i = this.length; i < this.backups.length; i++) {
        localStorage.removeItem(this.backups.pop());
      }  
    }
  }

  setLength(len) {
    this.length = len;
    if (this.backups.length > this.length) {
      for (let i = this.length; i < this.backups.length; i++) {
        localStorage.removeItem(this.backups.pop());
      }  
    }
  }

  addBackup(array, name) {
    if (this.backups.length >= this.length) {
      localStorage.removeItem(this.backups.pop());  
    }
    this.saveBinary(array, name);
    this.backups.unshift(name);
  }

  removeBackup(name) {
    localStorage.removeItem(name);
    let index = this.backups.indexOf(name);
    this.backups.splice(index, 1);
  }

  updateContainer() {
    if (this.backups.length == 0) {
      this.div.innerHTML = `<p>There are no saved backups yet.</p>`
      return;
    }

    this.div.innerHTML = "";
    for (let i = 0; i < this.backups.length; i++) {
      let entry = document.createElement("div");
      let date = new Date(parseInt(this.backups[i].split("_")[1]));
      entry.innerHTML = `<p>${date.toLocaleString('en-GB').replaceAll("/", "-").replace(", ", "-")}_${this.backups[i].split("_")[2]}</p>`;
      entry.classList.add("entry");
      let downloadButton = document.createElement("button");
      downloadButton.innerHTML = drawDownloadIcon();
      downloadButton.classList.add("download");
      downloadButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.downloadBinary(this.backups[i]);
      });
      entry.appendChild(downloadButton);
      let deleteButton = document.createElement("button");
      deleteButton.innerHTML = drawRemoveIcon();
      deleteButton.classList.add("delete");
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeBackup(this.backups[i]);
        this.div.removeChild(entry);
        if (this.backups.length == 0) this.div.innerHTML = `<p>There are no saved backups yet.</p>`;
      });
      entry.appendChild(deleteButton);
      entry.addEventListener("click", () => {
        this.callbacks.selectBackup(this.backups[i]);
      });
      this.div.appendChild(entry);
    }
  }

  getBinary(name) {
    let string = localStorage.getItem(name);
    let array = new Uint8Array(string.length/2);

    for (let i = 0; i < string.length/2; i++) {
      array[i] = Number(`0x${string.slice(i*2, (i*2)+2)}`);
    }

    return array;
  }

  getBinarySize(name) {
    return localStorage.getItem(name).length / 2;
  }

  saveBinary(array, name) {
    let string = "";

    for (let i = 0; i < array.length ; i++) {
      string += array[i].toString(16).padStart(2,0).toUpperCase();
    }

    localStorage.setItem(name, string);
  }

  downloadBinary(name) {
    const array = this.getBinary(name);
    const blob = new Blob([array.buffer], {type: 'application/octet-stream'});
    const url = window.URL.createObjectURL(blob);
    // downloadURL(url, name);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.bin`;
    document.body.appendChild(a);
    a.style.display = 'none';
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }

}