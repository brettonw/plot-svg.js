var PlotSvg = function () {
    var ps = Object.create(null);

    var conditionPlotDataArray = function (plotDataArray) {
        // condition the input arrays, there's really no reason to treat any
        // number in the array as more than 4 or 5 decimal places worth of
        // information because that puts them in sub-sub-pixel range for almost
        // all rendering cases, we copy the data in the array, rounded to the
        // needed degree of precision
        var targetPlotDataPrecision = 4;
        var plotDataArrayCount = plotDataArray.length;
        var newPlotDataArray = new Array(plotDataArrayCount);
        for (var i = 0; i < plotDataArrayCount; ++i) {
            var plotData = plotDataArray[i];
            var plotDataCount = plotData.length;
            var newPlotData = new Array(plotDataCount);
            for (var j = 0; j < plotDataCount; ++j) {
                var plotDatum = plotData[j];
                newPlotData[j] = { x: new Number(plotDatum.x.toPrecision(targetPlotDataPrecision)), y: new Number(plotDatum.y.toPrecision(targetPlotDataPrecision)) };
            }
            newPlotDataArray[i] = newPlotData;
        }
        return newPlotDataArray;
    };

    var buildDomain = function (plotDataArray) {
        // compute the range of the input array and use that to compute the
        // delta and a divisor that gives us less than 10 clean ticks
        var buildAxisDomain = function (arrayOfArrays, selector, expandDelta, displaySize) {
            // start by creating the base domain object, with the mapping from
            // compute space to display space, and empty ticks
            var domain = {
                "displaySize": displaySize,
                "min": 0.0,
                "delta":1.0,
                "ticks": [],
                "map": function (value) {
                    return this.displaySize * (value - this.min) / this.delta;
                }
            };

            // make sure we can get some valid computations here
            if ((arrayOfArrays.length > 0) && (arrayOfArrays[0].length > 0)) {
                // a function to compute the order of magnitude of a number, to use
                // for scaling
                var computeOrderOfMagnitude = function (number) {
                    number = Math.max(Math.abs(number), 1.0e-6);

                    // a big number, then a small number
                    var order = 0;
                    while (number >= 10.0) {
                        ++order; number /= 10.0;
                    }
                    while (number < 1) {
                        --order; number *= 10.0;
                    }
                    return order;
                };

                // functions to compute the range of the input array
                var arrayFilter = function (array, filterFunc, selector) {
                    var result;
                    if (typeof (selector) === 'function') {
                        result = selector(array[0]);
                        for (var i = 1, count = array.length; i < count; ++i) {
                            var test = selector(array[i]);
                            result = filterFunc(result, test);
                        }
                    } else {
                        result = array[0][selector];
                        for (var i = 1, count = array.length; i < count; ++i) {
                            var test = array[i][selector];
                            result = filterFunc(result, test);
                        }
                    }
                    return result;
                };

                // compute the ranges, then check that there *is* a range
                var min = arrayFilter(arrayOfArrays, Math.min, function (array) { return arrayFilter(array, Math.min, selector); });
                var max = arrayFilter(arrayOfArrays, Math.max, function (array) { return arrayFilter(array, Math.max, selector); });
                var delta = max - min;
                if (delta == 0) {
                    max = min + 1.0;
                    delta = 1.0;
                }

                // we might want to expand the delta range a little bit for display
                // purposes, just so lines don't rest right on an edge of the plot
                if (expandDelta) {
                    // expand the range by 1%...
                    var deltaDelta = delta * 0.01;
                    if (max != 0) {
                        max += deltaDelta;
                    }
                    if ((min != 0) && (min != 1)) {
                        min -= deltaDelta;
                    }
                    delta = max - min;
                }

                var tickOrderOfMagnitude = computeOrderOfMagnitude(delta);
                var tryScale = [1.0, 2.0, 2.5, 5.0, 10.0, 20.0, 25.0];
                var tryPrecision = [1, 1, 2, 1, 1, 1, 2];
                var tickDivisorBase = Math.pow(10, tickOrderOfMagnitude - 1);
                var tickDivisorIndex = 0;
                var tickDivisor = tickDivisorBase * tryScale[tickDivisorIndex];
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
                var tickCount = Math.round((domain.max - domain.min) / tickDivisor);
                var incr = (domain.max - domain.min) / tickCount;
                for (var i = 0; i <= tickCount; ++i) {
                    domain.ticks.push(domain.min + (i * incr));
                }
            }

            return domain;
        };

        // compute the domain of the data
        return {
            x: buildAxisDomain(plotDataArray, 'x', false, 600),
            y: buildAxisDomain(plotDataArray, 'y', false, 400),
            map: function (xy) {
                return {
                    x: this.x.map(xy.x),
                    y: this.y.map(xy.y)
                };
            }
        };
    };

    var startPlot = function (title, xAxis, yAxis, domain) {
        // create the raw SVG picture for display, assumes a width/height aspect ratio of 3/2
        var buffer = 0.15 * 400;
        var svg = '<div class="plot-svg-div">' +
                    '<svg class="plot-svg-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" ' +
                    'viewBox="' + ((7.0 * -buffer) / 4.0) + ', ' + (-buffer) + ', ' + (domain.x.displaySize + (3.0 * buffer)) + ', ' + (domain.y.displaySize + (2.0 * buffer)) + '" ' +
                    'preserveAspectRatio="xMidYMid meet"' +
                    '>' +
                    '<g transform="translate(0, 400), scale(1, -1)">';

        // format plot labels according to their order of magnitude and
        // desired precision
        var labelText = function (number, order, precision) {
            var divisor = Math.pow(10, order);
            var value = number / divisor;
            if (Math.abs (order) <= 3) {
                value *= Math.pow(10, order);
                precision = Math.max (0, precision - order);
                order = 0;
            }
            if (value != 0) {
                return value.toFixed(precision).toString() + ((order != 0) ? ("e" + order) : "");
            }
            return 0;
        };

        // draw the x ticks plus the labels
        var bottom = 0;
        var top = domain.y.displaySize;
        for (var i = 0, count = domain.x.ticks.length; i < count; ++i) {
            var ti = domain.x.ticks[i];
            var tick = domain.x.map(ti);
            svg += '<line x1="' + tick + '" y1="0" x2="' + tick + '" y2="' + top + '" class="plot-svg-tick-line" />'
            svg += '<text  x="' + tick + '" y="12.5" class="plot-svg-x-tick-label" transform="scale(1,-1)"><tspan dy="0.5em">' + labelText(ti, domain.x.orderOfMagnitude, domain.x.precision) + '</tspan></text>';
        }

        // draw the y ticks
        var left = 0;
        var right = domain.x.displaySize;
        for (var i = 0, count = domain.y.ticks.length; i < count; ++i) {
            var ti = domain.y.ticks[i];
            var tick = domain.y.map(ti);
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

    var finishPlot = function (svg) {
        return svg + "</svg></div><br>";
    };

    ps.multipleLine = function (title, xAxis, yAxis, plotDataArray) {
        var conditionedPlotDataArray = conditionPlotDataArray(plotDataArray);
        var domain = buildDomain(conditionedPlotDataArray);
        var svg = startPlot(title, xAxis, yAxis, domain);

        // make the plots
        var colors = ["blue", "red", "green", "orange", "purple"];
        for (var i = 0, count = conditionedPlotDataArray.length; i < count; ++i) {
            svg += '<polyline class="plot-svg-plot-line" stroke="' + colors[i] + '" points="';
            var plotData = conditionedPlotDataArray[i];
            for (var j = 0, jcount = plotData.length; j < jcount; ++j) {
                var datum = domain.map(plotData[j]);
                svg += datum.x + ',' + datum.y + ' ';
            }
            svg += '" />';
        }

        // finish the plot
        var svg = finishPlot(svg);
        return svg;
    };

    ps.singleLine = function (title, xAxis, yAxis, plotData) {
        return this.multipleLine(title, xAxis, yAxis, [plotData]);
    };

    ps.scatter = function (title, xAxis, yAxis, plotData) {
        var conditionedPlotDataArray = conditionPlotDataArray([plotData]);
        var domain = buildDomain(conditionedPlotDataArray);
        var svg = startPlot(title, xAxis, yAxis, domain);

        // make the plot
        /*
        var colors = ["blue"];
            svg += '<polyline fill="none" stroke="' + colors[i] + '" stroke-width="0.0075" points="';
            var plotData = conditionedPlotDataArray[i];
            for (var j = 0, jcount = plotData.length; j < jcount; ++j) {
                var datum = domain.map(plotData[j]);
                svg += datum.x + ',' + datum.y + ' ';
            }
            svg += '" />';
            */

        // finish the plot
        var svg = finishPlot(svg);
        return svg;
    };

    ps.wrap = function (svg, width, divId, cssClass) {
        var height = (2 * width) / 3;
        var result = '<div ';
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

    return ps;
} ();
