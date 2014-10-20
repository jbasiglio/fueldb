FuelDB
======

A realtime database

You can visit our [website](https://wonderfuel.io/fueldb/) to read the full documentation

## Usage ##

### Download ###

Check in the release section to download the latest version or find it [here](http://wonderfuel.io/fueldb/download.php).

### Installing ###

`npm install ws`

### Configuration ###

To change your configuration, edit the config/config.json file.

The defaut user/password is admin/admin, to create a new one use this command:

`node bin/manage-password {username} {password}`

If the user already exists, it only changes his password. To delete one, simply remove it from config/users.json

### Run ###

`npm start`

### Use ###

Use the [tutorials](http://wonderfuel.io/fueldb/howto.php) to get started

## Related module ##

- [WS](https://github.com/einaros/ws) - A fast websocket implementation for NodeJS

## License ##

(The MIT License)

Copyright (c) 2014 Joris Basiglio &lt;joris.basiglio@wonderfuel.io&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
