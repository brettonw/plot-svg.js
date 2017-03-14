/*
 PanZoomSvg.js is a Javascript module for manipulating the view parameters in PlotSvg.js.
 */
var PanZoomSvg = function () {
    var _ = Object.create(null);

    var debug = function (panZoomSvgData) {
        var panMatrix = panZoomSvgData.panMatrix;
        var zoomMatrix = panZoomSvgData.zoomMatrix;
         var output = "Tx (" + panMatrix.e.toPrecision(3) + ", " + panMatrix.f.toPrecision(3) + "), Sc (" + zoomMatrix.a.toPrecision(3) + ")";
         document.getElementById("debug").innerHTML = output;
    };

    var constrain = function (panZoomSvgData) {
        // viewbox -105,-60,780,520, vs 600x400
        var panMatrix = panZoomSvgData.panMatrix
        panMatrix.e = Math.max (Math.min(panMatrix.e, panZoomSvgData.plotWidth / panZoomSvgData.zoomMatrix.a), -panZoomSvgData.plotWidth);
        panMatrix.f = Math.max (Math.min(panMatrix.f, panZoomSvgData.plotHeight / panZoomSvgData.zoomMatrix.a), -panZoomSvgData.plotHeight);
    };

    var getPanZoomSvgData = function (event) {
        var target = event.currentTarget;

        // get the pand and zoom data...
        var panZoomSvgData = target.panZoomSvgData;
        if (!target.hasOwnProperty("panZoomSvgData")) {
            // the pan and zoom data has never been accessed, initialize it with sensible defaults
            panZoomSvgData = target.panZoomSvgData = {
                viewBox: target.viewBox.baseVal,
                panMatrix: target.getElementById("pan").transform.baseVal.getItem(0).matrix,
                zoomMatrix: target.getElementById("zoom").transform.baseVal.getItem(0).matrix,
                panScale: target.attributes.panscale.value,
                plotWidth: target.viewBox.baseVal.width / target.attributes.panscale.value,
                plotHeight: target.viewBox.baseVal.height / target.attributes.panscale.value,
                maxZoom: 4,
                count: 0,
                zoomData: {
                    index: 0,
                    table: []
                }
            };

            // generate a bunch of steps for zooming smoothly, this uses a square root curve for a
            // perceptually linear progression
            var table = panZoomSvgData.zoomData.table;
            var steps = 100;
            var range = panZoomSvgData.maxZoom - 1;
            for (var i = 0; i <= steps; ++i) {
                var delta = i / steps;
                table.push(1 + ((delta * delta) * range));
            }
        }
        return panZoomSvgData;
    };

    _.startDrag = function (event) {
        var panZoomSvgData = getPanZoomSvgData (event);
        var panMatrix = panZoomSvgData.panMatrix;
        panZoomSvgData.panData = {
            lastTranslate: {x: panMatrix.e, y: panMatrix.f},
            startPt: {x: event.offsetX, y: event.offsetY}
        };
        debug (panZoomSvgData);
    };

    _.endDrag = function (event){
        var panZoomSvgData = getPanZoomSvgData (event);
        delete panZoomSvgData.panData;
    };

    _.drag = function (event) {
        var panZoomSvgData = getPanZoomSvgData(event);
        if (panZoomSvgData.hasOwnProperty("panData")) {
            var panData = panZoomSvgData.panData;
            var startPt = panData.startPt;
            var delta = {x: event.offsetX - startPt.x, y: event.offsetY - startPt.y};
            var panMatrix = panZoomSvgData.panMatrix;
            var zoomMatrix = panZoomSvgData.zoomMatrix;
            var scale = zoomMatrix.a;
            var lastTranslate = panData.lastTranslate;
            var panScale = panZoomSvgData.panScale;
            panMatrix.e = lastTranslate.x + ((delta.x * panScale) / scale);
            panMatrix.f = lastTranslate.y - ((delta.y * panScale) / scale);
            constrain(panZoomSvgData);
            debug(panZoomSvgData);
        }
    };

    _.wheel = function (event) {
        var panZoomSvgData = getPanZoomSvgData(event);

        var zoomData = panZoomSvgData.zoomData;
        var panMatrix = panZoomSvgData.panMatrix;
        var zoomMatrix = panZoomSvgData.zoomMatrix;

        panZoomSvgData.count++;
        // check for some pre-existing values
        /*
        if (panZoomSvgData.zoomTableIndex != 0) {
            var lastScaleMinus1 = zoomSvgData.zoomTable[zoomSvgData.zoomTableIndex] - 1;
            var x = -translateMatrix.e / lastScaleMinus1;
            var y = -translateMatrix.f / lastScaleMinus1;
            console.log ("last (" + x + ", " + y + ")");
        }
        */

        // adjust the zoom according to the mouse motion
        if (event.deltaY > 0) {
            // positive is down/zoom out
            zoomData.index = Math.max(zoomData.index - 1, 0);
        } else if (event.deltaY < 0) {
            // negative is up/ zoom in
            zoomData.index = Math.min (zoomData.index + 1, zoomData.table.length - 1);
        }
        var scale = zoomData.table[zoomData.index];
        var scaleMinus1 = scale - 1.0;

        // the existing matrix transformation values represent a certain offset in x from a previous
        // zoom operation

        // compute the current center in normalized view space
        /*
         var center = {
         x: translateMatrix.e = -x * plotWidth * scaleMinus1,
         y: translateMatrix.f = -y * plotHeight * scaleMinus1
         }
         */

        // compute the current mouse position in normalized view space
        var panScale = panZoomSvgData.panScale;
        var viewBox = panZoomSvgData.viewBox;
        var mouse = {
            x: Math.min(Math.max(((event.offsetX * panScale) + viewBox.x) / panZoomSvgData.plotWidth, 0), 1),
            y: Math.min(Math.max((panZoomSvgData.plotHeight - ((event.offsetY * panScale) + viewBox.y)) / panZoomSvgData.plotHeight, 0), 1)
        };
        //console.log ("now: " + zoomSvgData.count + ", xy (" + mouse.x + ", " + mouse.y + ")");

        /*
         console.log ("-----");
         console.log ("event.offsetY: " + event.offsetY);
         console.log ("panscale: " + panScale);
         console.log ("(pre-subtraction): " + event.offsetY * panScale);
         console.log ("y: " + y);
         //y = y / plotHeight;
         console.log ("y (final): " + y);
         */


        //panMatrix.e = -mouse.x * panZoomSvgData.plotWidth * scale;
        //panMatrix.f = -mouse.y * panZoomSvgData.plotHeight * scale;

        //panMatrix.e = (panZoomSvgData.plotWidth * -0.5 / scale);// + (panZoomSvgData.plotWidth * -0.5 * scaleMinus1);
        //panMatrix.f = (panZoomSvgData.plotHeight * -0.5 / scale);// + (panZoomSvgData.plotHeight * -0.5 * scaleMinus1);

        panMatrix.e = (panZoomSvgData.plotWidth * 0.5 / scale);
        panMatrix.f = (panZoomSvgData.plotHeight * 0.5 / scale);

        zoomMatrix.a = zoomMatrix.d = scale;
        constrain (panZoomSvgData);
        debug (panZoomSvgData);

        // test
        //var x = -translateMatrix.e / scaleMinus1;
        //var y = -translateMatrix.f / scaleMinus1;
        //console.log ("test (" + x + ", " + y + ")");
    };

    _.dblClick = function (event) {
        var panZoomSvgData = getPanZoomSvgData (event);
        // reset
        var panMatrix = panZoomSvgData.panMatrix;
        panMatrix.e = panMatrix.f = 0;
        var zoomMatrix = panZoomSvgData.zoomMatrix;
        var zoomData = panZoomSvgData.zoomData;
        zoomData.index = 0;
        zoomMatrix.a = zoomMatrix.d = zoomData.table[zoomData.index];
        debug (panZoomSvgData);
    };

    _.handler = ' onmousedown="PanZoomSvg.startDrag(event)" onmouseup="PanZoomSvg.endDrag(event)" onmousemove="PanZoomSvg.drag(event)" onmousewheel="PanZoomSvg.wheel(event)" ondblclick="PanZoomSvg.dblClick(event)" ';

    return _;
} ();

/*
var PanZoomSvgData = function () {
    var _ = Object.create (null);

    _.init = function (target) {
        this.panMatrix = target.getElementById("pan").transform.baseVal.getItem(0).matrix;
        this.zoomMatrix = target.getElementById("zoom").transform.baseVal.getItem(0).matrix;
        this.panScale = target.attributes.panscale.value;
        this.count = 0;
        this.zoomData = {
            zoomTableIndex: 0,
            zoomTable: []
        }
    };

    _.startDrag = function (event) {

    };

    _.

    _.new = function (target) {
        return Object.create (PanZoomSvgData).init (target);
    };

    return _;
} ();
*/
