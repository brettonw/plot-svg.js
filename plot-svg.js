"use strict;"

/*
PlotSvg is a Javascript module for plotting simple 2D graphs from set of {x, y} points. Styling is
perfomed using CSS where possible.
 */
let PlotSvg = function () {
    let _ = Object.create(null);

    let plotWidth = 600;
    let plotHeight = 400;

    let legendX = 440;
    let legendY = 240;

    _.setLegendPosition = function (shouldLegendX, shouldLegendY) {
        legendX = shouldLegendX;
        legendY = shouldLegendY;
        return this;
    };

    // some styling values
    let plotLines = true;
    let plotPoints = true;

    _.setPlotLines = function (shouldPlotLines) {
        plotLines = shouldPlotLines;
        return this;
    };

    _.setPlotPoints = function (shouldPlotPoints) {
        plotPoints = shouldPlotPoints;
        return this;
    };

    colors = ["rgb(114,147,203)", "rgb(225,151,76)", "rgb(132,186,91)", "rgb(211,94,96)", "rgb(144,103,167)"];

    _.setColors = function (colorsArray) {
        colors = colorsArray;
        return this;
    };

    // a function to compute the order of magnitude of a number, to use for scaling
    let computeOrderOfMagnitude = function (number) {
        number = Math.max(Math.abs(number), 1.0e-6);

        // a big number, then a small number
        let order = 0;
        while (number >= 10.0) {
            ++order;
            number /= 10.0;
        }
        while (number < 1) {
            --order;
            number *= 10.0;
        }
        return order;
    };

    // apply a filter function across all the elements of an array
    let arrayFilter = function (array, filterFunc, selector) {
        let result;
        if (typeof (selector) === 'function') {
            result = selector(array[0]);
            for (let i = 1, count = array.length; i < count; ++i) {
                let test = selector(array[i]);
                result = filterFunc(result, test);
            }
        } else {
            result = array[0][selector];
            for (let i = 1, count = array.length; i < count; ++i) {
                let test = array[i][selector];
                result = filterFunc(result, test);
            }
        }
        return result;
    };

    // condition the input arrays, there's really no reason to treat any number in the array as more
    // than 4 or 5 decimal places worth of information within the range, because that puts them in
    // sub-sub-pixel range for almost all rendering cases, we copy the data in the array, rounded to
    // the needed degree of precision
    let conditionPlotDataArray = function (plotDataArray) {
        let targetPlotDataPrecision = 5;
        let plotDataArrayCount = plotDataArray.length;
        let newPlotDataArray = new Array(plotDataArrayCount);
        for (let i = 0; i < plotDataArrayCount; ++i) {
            let plotData = plotDataArray[i];
            let plotDataCount = plotData.length;
            let newPlotData = new Array(plotDataCount);
            for (let j = 0; j < plotDataCount; ++j) {
                let plotDatum = plotData[j];
                newPlotData[j] = {
                    x: new Number(plotDatum.x).toPrecision(targetPlotDataPrecision),
                    y: new Number(plotDatum.y).toPrecision(targetPlotDataPrecision)
                };
            }
            newPlotDataArray[i] = newPlotData;
        }
        return newPlotDataArray;
        //return plotDataArray;
    };

    // compute the range of the input array and use that to compute the delta and a divisor that
    // gives us less than 10 clean ticks
    let buildDomain = function (plotDataArray) {
        let buildAxisDomain = function (arrayOfArrays, selector, expandDelta, displaySize) {
            // start by creating the base domain object, with the mapping from
            // compute space to display space, and empty ticks
            let domain = {
                "displaySize": displaySize,
                "min": 0.0,
                "delta": 1.0,
                "ticks": [],
                "map": function (value) {
                    return this.displaySize * (value - this.min) / this.delta;
                }
            };

            // make sure we can get some valid computations here
            if ((arrayOfArrays.length > 0) && (arrayOfArrays[0].length > 0)) {
                // compute the ranges, then check that there *is* a range
                let min = arrayFilter(arrayOfArrays, Math.min, function (array) {
                    return arrayFilter(array, Math.min, selector);
                });
                let max = arrayFilter(arrayOfArrays, Math.max, function (array) {
                    return arrayFilter(array, Math.max, selector);
                });
                let delta = max - min;
                if (delta == 0) {
                    max = min + 1.0;
                    delta = 1.0;
                }

                // we might want to expand the delta range a little bit for display
                // purposes, just so lines don't rest right on an edge of the plot
                if (expandDelta) {
                    // expand the range by 1%...
                    let deltaDelta = delta * 0.01;
                    if (max != 0) {
                        max += deltaDelta;
                    }
                    if ((min != 0) && (min != 1)) {
                        min -= deltaDelta;
                    }
                    delta = max - min;
                }

                // compute the drawing scale, and the placement for tick divisor
                let tickOrderOfMagnitude = computeOrderOfMagnitude(delta);
                let tryScale = [1.0, 2.0, 2.5, 5.0, 10.0, 20.0, 25.0];
                let tryPrecision = [1, 1, 2, 1, 1, 1, 2];
                let tickDivisorBase = Math.pow(10, tickOrderOfMagnitude - 1);
                let tickDivisorIndex = 0;
                let tickDivisor = tickDivisorBase * tryScale[tickDivisorIndex];
                while ((delta / tickDivisor) > 9) {
                    tickDivisor = tickDivisorBase * tryScale[++tickDivisorIndex];
                }

                // now round the top and bottom to that divisor, and build the
                // domain object, starting with the basics
                domain.min = Math.floor(min / tickDivisor) * tickDivisor;
                domain.max = Math.ceil(max / tickDivisor) * tickDivisor;
                domain.delta = domain.max - domain.min;
                domain.orderOfMagnitude = computeOrderOfMagnitude(domain.max);

                // the numeric display precision
                domain.precision = tryPrecision[tickDivisorIndex];

                // the ticks
                let tickCount = Math.round((domain.max - domain.min) / tickDivisor);
                let incr = (domain.max - domain.min) / tickCount;
                for (let i = 0; i <= tickCount; ++i) {
                    domain.ticks.push(domain.min + (i * incr));
                }
            }

            return domain;
        };

        // compute the domain of the data
        return {
            x: buildAxisDomain(plotDataArray, 'x', false, plotWidth),
            y: buildAxisDomain(plotDataArray, 'y', false, plotHeight),
            map: function (xy) {
                return {
                    x: this.x.map(xy.x),
                    y: this.y.map(xy.y)
                };
            }
        };
    };

    // create the raw SVG picture for display, assumes a width/height aspect ratio of 3/2
    let startPlot = function (title, xAxis, yAxis, domain) {
        // this is carefully calculated to render a 600x400 graph in a 3x2 outer frame
        let buffer = 0.15 * domain.y.displaySize;
        let svg = '<div class="plot-svg-div">';
        svg += '<svg class="plot-svg-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" ';
        svg += 'viewBox="' + ((7.0 * -buffer) / 4.0) + ', ' + (-buffer) + ', ' + (domain.x.displaySize + (3.0 * buffer)) + ', ' + (domain.y.displaySize + (2.0 * buffer)) + '" ';
        svg += 'preserveAspectRatio="xMidYMid meet" ';
        svg += (typeof PanZoomSvg !== 'undefined') ? PanZoomSvg.handler : '';
        svg += ' panscale="' + ((domain.x.displaySize + (3.0 * buffer)) / domain.x.displaySize) + '" ';
        svg += '>';
        svg += '<g transform="translate(0, ' + domain.y.displaySize + '), scale(1, -1)">';
        svg += '<g id="zoom" transform="scale(1)" style="pointer-events:none;">';
        svg += '<g id="pan" transform="translate(0, 0)">';

        // format plot labels according to their order of magnitude and
        // desired precision
        let labelText = function (number, order, precision) {
            let divisor = Math.pow(10, order);
            let value = number / divisor;
            if (Math.abs(order) <= 3) {
                value *= Math.pow(10, order);
                precision = Math.max(0, precision - order);
                order = 0;
            }
            if (value != 0) {
                return value.toFixed(precision).toString() + ((order != 0) ? ("e" + order) : "");
            }
            return 0;
        };

        // draw the x ticks plus the labels
        let bottom = 0;
        let top = domain.y.displaySize;
        for (let i = 0, count = domain.x.ticks.length; i < count; ++i) {
            let ti = domain.x.ticks[i];
            let tick = domain.x.map(ti);
            svg += '<line x1="' + tick + '" y1="0" x2="' + tick + '" y2="' + top + '" class="plot-svg-tick-line" />'
            svg += '<text  x="' + tick + '" y="12.5" class="plot-svg-x-tick-label" transform="scale(1,-1)"><tspan dy="0.5em">' + labelText(ti, domain.x.orderOfMagnitude, domain.x.precision) + '</tspan></text>';
        }

        // draw the y ticks
        let left = 0;
        let right = domain.x.displaySize;
        for (let i = 0, count = domain.y.ticks.length; i < count; ++i) {
            let ti = domain.y.ticks[i];
            let tick = domain.y.map(ti);
            svg += '<line x1="0" y1="' + tick + '" x2="' + right + '" y2="' + tick + '" class="plot-svg-tick-line" />'
            svg += '<text  x="-7.5" y="' + -tick + '" class="plot-svg-y-tick-label" transform="scale(1,-1)"><tspan dy="0.33em">' + labelText(ti, domain.y.orderOfMagnitude, domain.y.precision) + '</tspan></text>';
        }

        // draw the title
        if (title != null) {
            svg += '<text x="' + (right / 2.0) + '" y="' + -(top + 30.0) + '" class="plot-svg-title" transform="scale(1,-1)"><tspan dy="0.33em">' + title + '</tspan></text>';
        }

        // draw the x-axis label
        if (xAxis != null) {
            svg += '<text x="' + (right / 2.0) + '" y="37.5" class="plot-svg-axis-label" transform="scale(1,-1)"><tspan dy="0.33em">' + xAxis + '</tspan></text>';
        }

        // draw the y-axis label
        if (yAxis != null) {
            svg += '<text x="' + (top / 2.0) + '" y="' + -(buffer + 20.0) + '" class="plot-svg-axis-label" transform="scale(1,-1), rotate(-90)"><tspan dy="0.33em">' + yAxis + '</tspan></text>';
        }

        return svg;
    };

    // add a legend
    let plotLegend = function (svg, legend) {
        let legendSize = 24;
        let legendBuffer = 6;
        let height = ((legendSize + legendBuffer) * legend.length) + legendBuffer;
        let x = legendX;
        let y = legendY - (height / 2);
        svg += '<rect class="plot-svg-plot-legend" x="' + x +'" y="' + y + '" height="' + height + '" />';
        for (let i = 0, count = legend.length, counter = 0; i < count; ++i) {
            if (legend[i].length > 0) {
                let xx = x + legendBuffer;
                let yy = (y + legendBuffer) + (counter++ * (legendSize + legendBuffer));
                svg += '<rect class="plot-svg-plot-legend-box" x="' + xx + '" y="' + yy + '" fill="' + colors[i % colors.length] + '" width="' + legendSize + '" height="' + legendSize + '"  />';
                xx += legendSize + legendBuffer;
                yy += legendBuffer;
                svg += '<text class="plot-svg-plot-legend-label" x="' + xx + '" y="-' + yy + '" transform="scale(1,-1)">' + legend[i] + '</text>';
            }
        }
        return svg;
    };

    let finishPlot = function (svg) {
        return svg + "</svg></div><br>";
    };

    _.multipleLine = function (title, xAxis, yAxis, plotDataArray, legend) {
        let conditionedPlotDataArray = conditionPlotDataArray(plotDataArray);
        let domain = buildDomain(conditionedPlotDataArray);
        let svg = startPlot(title, xAxis, yAxis, domain);

        // make the plots
        for (let i = 0, count = conditionedPlotDataArray.length; i < count; ++i) {
            // plot the lines
            if (plotLines) {
                svg += '<polyline class="plot-svg-plot-line" stroke="' + colors[i % colors.length] + '" points="';
                let plotData = conditionedPlotDataArray[i];
                for (let j = 0, jcount = plotData.length; j < jcount; ++j) {
                    let datum = domain.map(plotData[j]);
                    svg += datum.x + ',' + datum.y + ' ';
                }
                svg += '" />';
            }

            // plot the points
            if (plotPoints) {
                // put down the points
                let plotData = conditionedPlotDataArray[i];
                for (let j = 0, jcount = plotData.length; j < jcount; ++j) {
                    let datum = domain.map(plotData[j]);
                    svg += '<circle class="plot-svg-plot-point" fill="' + colors[i % colors.length] + '" r="4" cx="' + datum.x + '" cy="' + datum.y + '"><title>' + plotData[j].x + ', ' + plotData[j].y + '</title></circle>';
                }
            }
        }

        if ((legend !== undefined) && (legend.length > 0)) {
            svg = plotLegend(svg, legend);
        }

        // finish the plot
        svg = finishPlot(svg);
        return svg;
    };

    _.singleLine = function (title, xAxis, yAxis, plotData, legend) {
        return this.multipleLine(title, xAxis, yAxis, [plotData]);
    };

    _.scatter = function (title, xAxis, yAxis, plotData) {
        let conditionedPlotDataArray = conditionPlotDataArray([plotData]);
        let domain = buildDomain(conditionedPlotDataArray);
        let svg = startPlot(title, xAxis, yAxis, domain);

        // put down the points (this ignores the plotPoints and plotLines settings)
        for (let i = 0, count = conditionedPlotDataArray.length; i < count; ++i) {
            let plotData = conditionedPlotDataArray[i];
            for (let j = 0, jcount = plotData.length; j < jcount; ++j) {
                let datum = domain.map(plotData[j]);
                svg += '<circle class="plot-svg-plot-point" fill="' + colors[i % colors.length] + '" cx="' + datum.x + '" cy="' + datum.y + '"><title>' + plotData[j].x + ', ' + plotData[j].y + '</title></circle>';
            }
        }

        // finish the plot
        svg = finishPlot(svg);
        return svg;
    };

    _.barchart = function (title, xAxis, yAxis, plotData) {
        let conditionedPlotDataArray = conditionPlotDataArray([plotData]);
        let domain = buildDomain(conditionedPlotDataArray);
        let svg = startPlot(title, xAxis, yAxis, domain);

        // assuming the x axis is uniformly distributed, compute the width and offset for each bar

        // make the plots
        for (let i = 0, count = conditionedPlotDataArray.length; i < count; ++i) {
            // plot the bars
            svg += '<rect x="50" y="20" width="150" height="150">';

            // plot the points
            if (plotPoints) {
                // put down the points
                let plotData = conditionedPlotDataArray[i];
                for (let j = 0, jcount = plotData.length; j < jcount; ++j) {
                    let datum = domain.map(plotData[j]);
                    svg += '<circle class="plot-svg-plot-point" fill="' + colors[i % colors.length] + '" cx="' + datum.x + '" cy="' + datum.y + '"><title>' + plotData[j].x + ', ' + plotData[j].y + '</title></circle>';
                }
            }
        }

        // finish the plot
        svg = finishPlot(svg);
        return svg;
    };

    _.wrap = function (svg, width, divId, cssClass) {
        let height = (2 * width) / 3;
        let result = '<div ';
        if (divId != null) {
            result += 'id="' + divId + '" ';
        }
        result += 'style="width:' + width + 'px;height:' + height + 'px;padding:0px;border:none;" ';
        if (cssClass != null) {
            result += 'class="' + cssClass + '" ';
        }
        result += '>' + svg + '</div>';
        return result;
    };

    let debug = function (panZoomNode) {
        let baseVal = panZoomNode.transform.baseVal;
        let translateMatrix = baseVal.getItem (0).matrix;
        let scale = baseVal.getItem (1).matrix.a.toPrecision(3);
        let output = "Tx (" + translateMatrix.e.toPrecision(3) + ", " + translateMatrix.f.toPrecision(3) + "), Sc (" + scale + ")";
        let debugDiv = document.getElementById("debug");
        debugDiv.innerHTML = output;
    };

    let constrain = function (panZoomNode) {
        return;
        // viewbox -105,-60,780,520, vs 600x400
        let baseVal = panZoomNode.transform.baseVal;
        let translateMatrix = baseVal.getItem (0).matrix;
        let scale = (baseVal.getItem (1).matrix.a) - 1.0;

        // XXX want to get rid of these damn magic numbers...
        let minX = -780 * scale;
        let maxX = 105 * scale;
        if (translateMatrix.e < minX) { translateMatrix.e = minX; }
        if (translateMatrix.e > maxX) { translateMatrix.e = maxX; }

        let minY = -520 * scale;
        let maxY = 60 * scale;
        if (translateMatrix.f < minY) { translateMatrix.f = minY; }
        if (translateMatrix.f > maxY) { translateMatrix.f = maxY; }


    };

    _.startDrag = function (event) {
        let panZoomNode = event.currentTarget.getElementById("pan/zoom");
        let plotSvgDragData = panZoomNode.plotSvgDragData = {};
        let transform = panZoomNode.transform.baseVal.getItem (0).matrix;
        plotSvgDragData.lastTranslate = { x: transform.e, y: transform.f};
        plotSvgDragData.startPt = { x: event.offsetX, y: event.offsetY };
        plotSvgDragData.panScale = panZoomNode.attributes.panscale.value;
        debug (panZoomNode);
    };

    _.endDrag = function (event){
        let panZoomNode = event.currentTarget.getElementById("pan/zoom");
        delete panZoomNode.plotSvgDragData;
    };

    _.drag = function (event){
        let panZoomNode = event.currentTarget.getElementById("pan/zoom");
        if (panZoomNode.hasOwnProperty ("plotSvgDragData")) {
            let plotSvgDragData = panZoomNode.plotSvgDragData;
            let startPt = plotSvgDragData.startPt;
            let delta = { x:event.offsetX - startPt.x, y:event.offsetY - startPt.y };
            let translateMatrix = panZoomNode.transform.baseVal.getItem (0).matrix;
            let lastTranslate = plotSvgDragData.lastTranslate;
            let panScale = plotSvgDragData.panScale;
            translateMatrix.e = lastTranslate.x + (delta.x * panScale);
            translateMatrix.f = lastTranslate.y - (delta.y * panScale);
            constrain (panZoomNode);
            debug (panZoomNode);
        }
    };

    let zoomTable = [];
    _.wheel = function (event) {
        // get the pan/zoom node under the event target
        let panZoomNode = event.currentTarget.getElementById("pan/zoom");

        // get the plot zoom data... if the plot zoom data has never been accessed, initialize it
        // with sensible defaults
        let plotSvgZoomData = panZoomNode.plotSvgZoomData;
        if (!panZoomNode.hasOwnProperty("plotSvgZoomData")) {
            plotSvgZoomData = panZoomNode.plotSvgZoomData = {};
            plotSvgZoomData.zoomTableIndex = 0;
            plotSvgZoomData.panScale = panZoomNode.attributes.panscale.value;
            plotSvgZoomData.count = 0;

            // generate a bunch of steps for zooming smoothly, this uses a square root curve for a
            // perceptually linear progression
            let steps = 100;
            let range = 3;
            for (let i = 0; i <= steps; ++i) {
                let delta = i / steps;
                zoomTable.push(1 + ((delta * delta) * range));
            }
        }

        // set up the basic data we'll use
        let baseVal = panZoomNode.transform.baseVal;
        let translateMatrix = baseVal.getItem (0).matrix;
        let scaleMatrix = baseVal.getItem (1).matrix;
        plotSvgZoomData.count++;

        // check for some pre-existing values
        if (plotSvgZoomData.zoomTableIndex != 0) {
            let lastScaleMinus1 = zoomTable[plotSvgZoomData.zoomTableIndex] - 1;
            let x = -translateMatrix.e / lastScaleMinus1;
            let y = -translateMatrix.f / lastScaleMinus1;
            console.log ("last (" + x + ", " + y + ")");
        }

        // adjust the zoom according to the mouse motion
        if (event.deltaY > 0) {
            // positive is down/out
            plotSvgZoomData.zoomTableIndex = Math.max(plotSvgZoomData.zoomTableIndex - 1, 0);
        } else if (event.deltaY < 0) {
            plotSvgZoomData.zoomTableIndex = Math.min (plotSvgZoomData.zoomTableIndex + 1, zoomTable.length - 1);
        }
        let scale = zoomTable[plotSvgZoomData.zoomTableIndex];
        let scaleMinus1 = scale - 1.0;

        // the existing matrix transformation values represent a certain offset in x from a previous
        // zoom operation

        // compute the current center in normalized view space
        /*
        let center = {
            x: translateMatrix.e = -x * plotWidth * scaleMinus1,
            y: translateMatrix.f = -y * plotHeight * scaleMinus1
        }
        */

        // compute the current mouse position in normalized view space
        let panScale = panZoomNode.attributes.panscale.value;
        let mouse = {
            x: Math.min(Math.max(((event.offsetX * panScale) - 105) / plotWidth, 0), 1),
            y: Math.min(Math.max((plotHeight - ((event.offsetY * panScale) - 60)) / plotHeight, 0), 1)
        };
        console.log ("now: " + plotSvgZoomData.count + ", xy (" + mouse.x + ", " + mouse.y + ")");

        /*
        console.log ("-----");
        console.log ("event.offsetY: " + event.offsetY);
        console.log ("panscale: " + panScale);
        console.log ("(pre-subtraction): " + event.offsetY * panScale);
        console.log ("y: " + y);
        //y = y / plotHeight;
        console.log ("y (final): " + y);
*/

        translateMatrix.e = -mouse.x * plotWidth * scaleMinus1;
        translateMatrix.f = -mouse.y * plotHeight * scaleMinus1;
        scaleMatrix.a = scaleMatrix.d = scale;
        constrain (panZoomNode);
        debug (panZoomNode);

        // test
        //let x = -translateMatrix.e / scaleMinus1;
        //let y = -translateMatrix.f / scaleMinus1;
        //console.log ("test (" + x + ", " + y + ")");
    };

    _.dblClick = function (event) {
        // reset
        let panZoomNode = event.currentTarget.getElementById("pan/zoom");
        let baseVal = panZoomNode.transform.baseVal;
        let translateMatrix = baseVal.getItem (0).matrix;
        translateMatrix.e = translateMatrix.f = 0;
        let scaleMatrix = baseVal.getItem (1).matrix;
        scaleMatrix.a = scaleMatrix.d = 1;
        debug (panZoomNode);
    };

    return _;
}();

