# WebUSB programmer for CH32V003
You can take ``webusb_new.js`` and ``flasher.js`` and use them in your project if you want to add updatting firmware functionality.
I will add detailed description later.

Working copy: [https://subjectiverealitylabs.com/WeblinkUSB/](https://subjectiverealitylabs.com/WeblinkUSB/)
# Usage

Do ``npm install`` or ``yarn install`` to install [parcel](https://parceljs.org/) that is used for packaging.

``npm start`` - to launch a live server at localhost:1234

``npm build`` - will bundle all files in correspondent folders in ./dist/

``npx parcel serve --https`` if you want to try it from another device on your network (WebHID requires an https connection)
