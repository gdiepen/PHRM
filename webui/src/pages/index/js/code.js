const $ = require('jquery')
const { DateTime } = require('luxon')
const d3 = require('d3')
const bootstrap = require('bootstrap')
const datetimepicker = require('jquery-datetimepicker')




window.$ = $
//window.bootstrap = bootstrap
//window.aaa = DateTime


let svg_properties = {}
svg_properties.inner_margin_left = 60 ;
svg_properties.inner_margin_top = 10 ;
svg_properties.inner_margin_right = 60 ;
svg_properties.inner_margin_bottom = 10 ;
let store = {}

store.selection = {}
store.selection.active_downloads = 0  ;


let initialized = false
store.settings = {}
store.gui = {}


if (localStorage.getItem("store") === null){
	store.settings.smoothing_method = "gaussian" ;
	store.settings.gaussian_bucket_size = "60" ; 
	store.settings.gaussian_stddev = "2" ; 
	store.settings.moving_average_bucket_size = "60" ; 
	store.settings.moving_average_window = "10" ; 
	store.settings.range_start_day = "20200101" ; 
	store.settings.range_end_day = DateTime.local().toFormat("yyyyLLdd"); 
	store.settings.range_interval = "0.6" ;
	store.settings.range_percentiles = [0.2, 0.5, 0.8];
	store.settings.range_relevant_weekdays = "0,1,2,3,4,5,6";

	store.gui.max_heart_rate = 200

	localStorage.setItem("store", JSON.stringify(store))
}
else{
	store.settings = JSON.parse(localStorage.getItem("store")).settings
	store.gui = JSON.parse(localStorage.getItem("store")).gui
	initialized=true
}

window.mystore = store
store.settings.active_day = DateTime.local().toFormat("yyyyLLdd"); 


$("#datepicker").val(DateTime.local().toFormat("yyyy-LL-dd"))
console.log(store)



let bisectTime = d3.bisector(function(d) { return d.hours_since_midnight;}).left ; 


svg_properties.svg_select = d3.select("#svg-content")

function determine_svg_size(){
    //Retrieve the height information from the svg-content

    let new_height = parseInt( window.getComputedStyle( svg_properties.svg.node() ).getPropertyValue('height') ) -
        parseInt( window.getComputedStyle( svg_properties.svg.node() ).getPropertyValue('margin-top') ) -
        parseInt( window.getComputedStyle( svg_properties.svg.node() ).getPropertyValue('margin-bottom') ) - 
        parseInt( window.getComputedStyle( d3.select('footer').node() ).getPropertyValue('height'))

    let new_width = parseInt( window.getComputedStyle( svg_properties.svg.node() ).getPropertyValue('width') ) -
        parseInt( window.getComputedStyle( svg_properties.svg.node() ).getPropertyValue('margin-left') ) -
        parseInt( window.getComputedStyle( svg_properties.svg.node() ).getPropertyValue('margin-right') )

    svg_properties.width = new_width ;  
    svg_properties.height = new_height ;  

    console.log(svg_properties)
}

function updateScales(){
    store.x.range([0,svg_properties.width -svg_properties.inner_margin_left - svg_properties.inner_margin_right])
    store.y.range([svg_properties.height, 0]);

	store.y.domain([0, store.gui.max_heart_rate])

    console.log(svg_properties)
    svg_properties.svg_select.select(".xaxis")
        .transition().duration(750)
        .attr("transform", "translate(0," + svg_properties.height + ")")
        .call(svg_properties.xAxis)

    svg_properties.svg_select.select(".yaxis")
        .transition().duration(750)
        .call(svg_properties.yAxis)


    d3.select("#svg-content").select(".overlay")
        .attr("width", svg_properties.width - svg_properties.inner_margin_left - svg_properties.inner_margin_right)
        .attr("height", svg_properties.height)


    svg_properties.svg_select.select(".prev-day-btn")
        .transition().duration(750)
        .attr("transform", "translate(-50,"+svg_properties.height/2+")")

    svg_properties.svg_select.select(".next-day-btn")
        .transition().duration(750)
        .attr("transform", "translate("+ (svg_properties.width - 110)+","+svg_properties.height/2+")")



}


function initialSetup(){
    // First we store the svg node in the svg_properties object
    svg_properties.svg = d3.select("#svg-content")
    svg_properties.root_g = svg_properties.svg.append('g')
        .attr("transform", "translate(" + svg_properties.inner_margin_left + "," + svg_properties.inner_margin_top+ ")");


    // Now we can call the determine_svg_size function
    determine_svg_size()

    // Now start adding the different layers
    let g = svg_properties.root_g

    svg_properties.layer_range = g.append("g")
    svg_properties.layer_median = g.append("g")
    svg_properties.layer_day = g.append("g")

    //Create the scales 
    store.x = d3.scaleLinear()
        .domain([0,24])
        .range([0,svg_properties.width -svg_properties.inner_margin_left - svg_properties.inner_margin_right])


    svg_properties.xAxis = d3.axisBottom(store.x)

    svg_properties.layer_x_axis = g.append("g")
        .attr("class", "xaxis")
        .attr("transform", "translate(0," + svg_properties.height + ")")
        .call(svg_properties.xAxis);

    svg_properties.day_description = g.append("g").append("text")
        .attr("transform", "translate(20,10)")
        .append("tspan")
        .attr("id", "day-description")

    // Add Y axis
    store.y = d3.scaleLinear()
        .domain([0, store.gui.max_heart_rate])
        .range([svg_properties.height, 0]);

    svg_properties.yAxis = d3.axisLeft(store.y)
    svg_properties.layer_y_axis = g.append("g")
        .attr("class", "yaxis")
        .call(svg_properties.yAxis);




    var focus = g.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("line")
        .attr("class", "x-hover-line hover-line")
        .attr("y1", 0)
        .attr("y2", svg_properties.height);

    //focus.append("line")
    //    .attr("class", "y-hover-line hover-line")
    //    .attr("x1", svg_properties.width)
    //    .attr("x2", svg_properties.width);

    focus.append("circle")
        .attr("r", 7.5);

    focus.append("text")
        .attr("x", 15)
        .attr("dy", ".31em");

    d3.select("#svg-content").append("rect")
        .attr("transform", "translate(" + svg_properties.inner_margin_left + "," + svg_properties.inner_margin_top+ ")")
        .attr("class", "overlay")
        .attr("width", svg_properties.width - svg_properties.inner_margin_left - svg_properties.inner_margin_right)
        .attr("height", svg_properties.height)
        .on("mouseover", function () {focus.style("display", null);})
        .on("mouseout", function () {focus.style("display", "none");})
        .on("mousemove", mousemove);

    function print_hours(float_hours){
        hours = (""+parseInt(Math.floor(float_hours))).padStart(2,'0') ; 
        minutes = (""+parseInt( 60 * (float_hours - hours))).padStart(2,'0') ; 
        seconds = ("" + parseInt( 3600 * (float_hours -  hours - minutes/60.0))).padStart(2,'0') ; 
        _time = hours + ':' + minutes  + ':' + seconds; 

        return _time ; 
    }


    function mousemove() {
        var x0 = store.x.invert(d3.mouse(this)[0]),
            i = bisectTime(store.data_day, x0, 1),
            d0 = store.data_day[i - 1],
            d1 = store.data_day[i]

		if (d1 === undefined){
			focus.style("display", "none");
			return
		}
		else{
			focus.style("display", null);
		}
        
        var d = x0 - d0.hours_since_midnight > d1.hours_since_midnight - x0 ? d1 : d0;
        focus.attr("transform", "translate(" + store.x(d.hours_since_midnight) + "," + store.y(d.value) + ")");

        focus_selection = focus.select("text")
            .selectAll("tspan")
            .data( [ print_hours(d.hours_since_midnight), 'Heart rate: ' + parseInt(d.value) ] )

        focus_selection.enter()
            .append('tspan')

        focus_selection
            .attr('dy', 19)
            .attr('text-anchor', d.hours_since_midnight <= 12 ? "begin" : "end" )
            .attr('x', d.hours_since_midnight <= 12 ? 17 : -17)
            .text( function(d){ return d } )

        focus.select(".x-hover-line").attr("y2", svg_properties.height - store.y(d.value));
        focus.select(".y-hover-line").attr("x2", svg_properties.width + svg_properties.width);
    }

    g.append("g")
        .attr("class", "prev-day-btn")
        .attr("transform", "translate(-50,"+svg_properties.height/2+")")
        .append("text").attr("font-size", "30px").text('❮')
        .on("click", function(){
            let prev_day = DateTime.fromISO(store.settings.active_day).plus({days:-1})

            store.settings.active_day = prev_day.toFormat("yyyyLLdd")
            $("#datepicker").val(prev_day.toFormat("yyyy-LL-dd"))

            loadDailyData()
        })

    g.append("g")
        .attr("class", "next-day-btn")
        .attr("transform", "translate("+ (svg_properties.width - 110)+","+svg_properties.height/2+")")
        .append("text").attr("font-size", "30px").text('❯')
        .on("click", function(){
            let next_day = DateTime.fromISO(store.settings.active_day).plus({days:1})


            store.settings.active_day = next_day.toFormat("yyyyLLdd")
            $("#datepicker").val(next_day.toFormat("yyyy-LL-dd"))

            loadDailyData()
        })
}


function importData(date_range_start, date_range_end, separate_dates){
    store.selection.active_downloads += 1 ;
    $("#reloadspinner").addClass('fa-spin')

	let post_arguments = JSON.parse(JSON.stringify(store.settings))

	post_arguments.range_start_day = date_range_start ; 
	post_arguments.range_end_day = date_range_end ; 
	post_arguments.separate_dates = separate_dates 

	console.log(post_arguments)
    d3.json('/api/refresh_data', {
        method: "POST",
        body: JSON.stringify(post_arguments),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    }).then( () => {

        store.selection.active_downloads -= 1 ; 
        if (store.selection.active_downloads <= 0){
            store.selection.active_downloads = 0 ; 
            $("#reloadspinner").removeClass('fa-spin') ;
        }



        if ((date_range_start !== null) && (separate_dates !== null)){
            loadAllData()
            console.log("Got indication data is available, loading all data")
        }
        else if (date_range_start !== null){
            loadRangeData() ; 
            console.log("Got indication data is available, loading range data")
        }
        else{
            loadDailyData() ; 
            console.log("Got indication data is available, loading daily data")
        }




    }).catch( (error) => {
        console.log(error) ;
        $("#reloadspinner").removeClass('fa-spin') ;
    })

}


function loadRangeData(){
	const searchParams = new URLSearchParams()
	Object.entries(store.settings).forEach(([key, value]) => {
		if (Array.isArray(value)){

			value.forEach(arr_value => {
				searchParams.append(key, arr_value) ;
			});
		}
		else{

			searchParams.append(key, value)
		}

	});

    let api_query_url_quantiles = "/api/quantiles/" + store.settings.range_start_day + "/" + store.settings.range_end_day + "?" + searchParams.toString()

    store.selection.active_downloads += 1 ; 
    $("#reloadspinner").addClass('fa-spin') ;

    d3.json(api_query_url_quantiles).then(dataset => {
        store.data_quantiles = dataset ;

        store.selection.active_downloads -= 1 ; 
        if (store.selection.active_downloads <= 0){
            store.selection.active_downloads = 0 ; 
            $("#reloadspinner").removeClass('fa-spin') ;
        }
        showRangeData();
    })
}




function loadDailyData(){
	const searchParams = new URLSearchParams()
	Object.entries(store.settings).forEach(([key, value]) => {
		if (Array.isArray(value)){

			value.forEach(arr_value => {
				searchParams.append(key, arr_value) ;
			});
		}
		else{

			searchParams.append(key, value)
		}

	});




    let api_query_url_day = "/api/day/" + store.settings.active_day + "?" + searchParams.toString()

    store.selection.active_downloads += 1 ; 
    $("#reloadspinner").addClass('fa-spin') ;


    d3.json(api_query_url_day).then(dataset => {
        store.data_day = dataset ;

        store.selection.active_downloads -= 1 ; 
        if (store.selection.active_downloads <= 0){
            store.selection.active_downloads = 0 ; 
            $("#reloadspinner").removeClass('fa-spin') ;
        }

        showDailyData();
    })



}


function loadAllData(){

    store.selection.active_downloads += 1 ; 
    $("#reloadspinner").addClass('fa-spin') ;

	const searchParams = new URLSearchParams()
	Object.entries(store.settings).forEach(([key, value]) => {
		if (Array.isArray(value)){

			value.forEach(arr_value => {
				searchParams.append(key, arr_value) ;
			});
		}
		else{

			searchParams.append(key, value)
		}

	});


    let api_query_url_day = "/api/day/" + store.settings.active_day + "?" + searchParams.toString()
    let api_query_url_quantiles = "/api/quantiles/" + store.settings.range_start_day + "/" + store.settings.range_end_day + "?" + searchParams.toString()





    Promise.all([
        d3.json(api_query_url_quantiles),
        d3.json(api_query_url_day)
    ]).then(datasets => {
        store.data_quantiles = datasets[0] ; 
        store.data_day = datasets[1] ;

        console.log(store.data_quantiles)
        console.log(store.data_day)

        store.selection.active_downloads -= 1 ; 
        if (store.selection.active_downloads <= 0){
            store.selection.active_downloads = 0 ; 
            $("#reloadspinner").removeClass('fa-spin') ;
        }

        showDailyData();
        showRangeData();
    })

}

function showDailyData(){
    let day_points = svg_properties.layer_day
        .selectAll('.day')
        .data([store.data_day])



    //.attr("stroke", "steelblue")

    day_points.enter()
        .append("path")
        .attr("fill", "none")
        .attr("class", "day")
        .attr("stroke", "url(#linearGradient)")
        .attr("stroke-width", 2)
        .attr("d", d3.line()
            .x(function (d) {return store.x(12)})
            .y(function (d) {return store.y(100)})
        )
        .merge(day_points)
        .transition()
        .duration(750)
        .attr("d", d3.line()
            .x(function (d) {return store.x(+d.hours_since_midnight)})
            .y(function (d) {return store.y(+d.value)})
        ) ;

    day_points.exit()
		.remove();


    svg_properties.day_description
        .transition()
        .duration(100)
        .style('opacity' , '0')
        .transition()
        .duration(100)
        .text(DateTime.fromISO(store.settings.active_day).toFormat("cccc LLLL d, yyyy"))
        .style('opacity' , '1')
        .end()

}


function showRangeData(){
    let range_points = svg_properties.layer_range
        .selectAll('.myarea')
        .data([store.data_quantiles])

    range_points.enter()
        .append("path")
        .attr("fill", "#cce5df")
        .attr("class", "myarea")
        .attr("stroke", "none")
        .attr("d", d3.area()
            .x(function (d) {return store.x(d.hours_since_midnight)})
            .y0(function (d) {return store.y(0)})
            .y1(function (d) {return store.y(store.gui.max_heart_rate)})
        )
        .merge(range_points)
        .transition()
        .duration(750)
        .attr("d", d3.area()
            .x(function (d) {return store.x(d.hours_since_midnight)})
            .y0(function (d) {return store.y(d[0])})
            .y1(function (d) {return store.y(d[2])})
        )

    range_points.exit().remove()

    let median_points = svg_properties.layer_median
        .selectAll(".median")
        .data([store.data_quantiles])

    median_points.enter()
        .append("path")
        .attr("fill", "none")
        .attr("class", "median")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 0.50)
        .attr("d", d3.line()
            .x(function (d) {return store.x(d.hours_since_midnight)})
            .y(function (d) {return store.y(0)})
        )
        .merge(median_points)
        .transition()
        .duration(750)
        .attr("d", d3.line()
            .x(function (d) {return store.x(d.hours_since_midnight)})
            .y(function (d) {return store.y(d[1])})
        )

    median_points.exit().remove()





}

function handleKeyDown(e) {
    console.log(e.code)
    if (e.target === d3.select("body").node()){
        if (e.code === "Home"){

            console.log("Home button!~!")
            store.settings.active_day = DateTime.local().toFormat('yyyyLLdd')
            $("#datepicker").val(DateTime.local().toFormat('yyyy-LL-dd'))


            loadDailyData()
        }
        if (e.code === "ArrowLeft"){
            let next_day = DateTime.fromISO(store.settings.active_day).plus({days: -1})

            store.settings.active_day = next_day.toFormat("yyyyLLdd")
            $("#datepicker").val(next_day.toFormat("yyyy-LL-dd"))

            loadDailyData()
        }
        if (e.code === "ArrowRight"){
            let next_day = DateTime.fromISO(store.settings.active_day).plus({days: 1})

            store.settings.active_day = next_day.toFormat("yyyyLLdd")
            $("#datepicker").val(next_day.toFormat("yyyy-LL-dd"))

            loadDailyData()
        }
    }
}

function redraw(){
	determine_svg_size() ; 
	updateScales() ;
}

$(document).ready(function() {
    $(window).resize(function() {
		redraw()

		showRangeData() ; 
		showDailyData() ; 
    })  



	$(".dropdown-menu[aria-labelledby=dropdownSmoothing] a").click(function () {
		// Get text from anchor tag
		var _method = $(this).text();
		$('#dropdownSmoothing').text(_method)

		$(".method-options").hide()
		$(".method-options-" + $(this).attr("data-value")   ).show()

		$("#smoothing-method").val($(this).attr("data-value"));
	});

	$("#dropdownSmoothingOptions a").filter("[data-initial=1]").trigger("click");


    $.datetimepicker.setLocale('en');
    $("#datepicker").datetimepicker({
        onSelectDate: function(){
            store.settings.active_day = DateTime.fromISO($("#datepicker").val()).toFormat("yyyyLLdd"); 
            loadDailyData()
        },
        timepicker:false,
        format: 'Y-m-d'
    });

    d3.select("#datepicker").on("change", function(){
        console.log( $("#datepicker").val())
        store.settings.active_day = DateTime.fromISO($("#datepicker").val()).toFormat("yyyyLLdd"); 
        loadDailyData()
    })



    $("#range_start").datetimepicker({
        onSelectDate: function(){
        },
        timepicker:false,
        format: 'Y-m-d',
        formatDate: 'Y-m-d',
        onShow:function(ct){
            this.setOptions({
                maxDate:$('#range_end').val()?$('#range_end').val():false
            })
        }

    });

    $("#range_end").datetimepicker({
        onSelectDate: function(){
        },
        timepicker:false,
        format: 'Y-m-d',
        formatDate: 'Y-m-d',
        onShow:function(ct){
            this.setOptions({
                minDate:$('#range_start').val()?$('#range_start').val():false
            })
        }
    });







    d3.select("#reloadButton").on("click", function(){
        importData(store.settings.range_start_day, store.settings.range_end_day, [store.settings.active_day])
		return
		

		var new_g = svg_properties.svg_select.append("g")
		new_g.append("rect")
			.attr("width", svg_properties.width)
			.attr("height", svg_properties.height + svg_properties.inner_margin_top + svg_properties.inner_margin_bottom)
			.style('fill', "#000")
			.style('opacity', 0.5)
			.transition()
			.duration(750)

				
		var heart_shape_enclosure = new_g
			.append("g")
			.attr("id", "heart-shape-enclosure")
			.style("fill", "none")
			.style("stroke", "#512DA8")
			.style("stroke-linejoin", "round")
			.style("stroke-width", "0.1px") 
			.attr("transform", "translate("+ svg_properties.width/2+"," + (svg_properties.height+ svg_properties.inner_margin_top + svg_properties.inner_margin_bottom)/2 + ") scale(35,35)")



		var heart_shape_path = heart_shape_enclosure
			.append("path")
			.attr("id", "heart-path")
			.attr("d","M13.075 3.925A3.157 3.157 0 0 0 10.842 3c-.838 0-1.641.478-2.233 1.07L8 4.68l-.609-.61c-1.233-1.233-3.233-1.378-4.466-.145a3.158 3.158 0 0 0 0 4.467L3.534 9 8 13.788 12.466 9l.609-.608a3.157 3.157 0 0 0 0-4.467z")



		var bbox = d3.select("#heart-path").node().getBBox()
		console.log(bbox)

		d3.select("#heart-path")
			.attr("transform", "translate(" + (-bbox.x - bbox.width/2) + "," + (-bbox.y - bbox.height/2) +")")


		console.log(d3.select("#heart-path"))


		heart_shape_enclosure
			.transition()
			.duration(800)
			.style("stroke-width", "2px") 
			.transition()
			.duration(400)
			.style("stroke-width", "1.5px") 
			.transition()
			.duration(400)
			.style("stroke-width", "2px") 
			.transition()
			.duration(800)
			.style("stroke-width", "0.1px") 




    })


    $("#settingsButton").click(function(){

        store.settings.range_relevant_weekdays.split(",").forEach(function(e){
            $('[name=inlineWeekdayOptions][value='+e+']' ).prop("checked", true)
        })


        $("#moving-average-bucket-size").val(store.settings.moving_average_bucket_size)
        $("#moving-average-window").val(store.settings.moving_average_window)
        $("#range_start").val( DateTime.fromISO(store.settings.range_start_day).toFormat('yyyy-LL-dd'))
        $("#range_end").val( DateTime.fromISO(store.settings.range_end_day).toFormat('yyyy-LL-dd'))
        $("#range-interval").val(store.settings.range_interval )
        $("#gaussian-bucket-size").val(store.settings.gaussian_bucket_size )
        $("#gaussian-stddev").val(store.settings.gaussian_stddev)

		$("#smoothing-method").val(store.settings.smoothing_method)  
		$("#max-heart-rate").val(store.gui.max_heart_rate)  


        $("#reserveModal").modal() ; 

    }) ; 


    $("#settingsSubmit").click(function(e){
        // 
        e.preventDefault()
        var checked=[]
        $('[name=inlineWeekdayOptions]:checked').each(function(){
            checked.push($(this).val());
        });

        store.settings.moving_average_bucket_size = $("#moving-average-bucket-size").val()
        store.settings.moving_average_window = $("#moving-average-window").val()
        store.settings.range_relevant_weekdays = checked.join(',')
        store.settings.range_start_day = DateTime.fromISO( $("#range_start").val()).toFormat("yyyyLLdd")
        store.settings.range_end_day = DateTime.fromISO( $("#range_end").val()).toFormat("yyyyLLdd")
        store.settings.range_interval = $("#range-interval").val()
		store.settings.range_percentiles = [ 0.5 -  $("#range-interval").val() / 2, 0.5, 0.5 + $("#range-interval").val() / 2] ;
        store.settings.gaussian_bucket_size = $("#gaussian-bucket-size").val()
        store.settings.gaussian_stddev = $("#gaussian-stddev").val()

		store.settings.smoothing_method = $("#smoothing-method").val()


		store.gui.max_heart_rate = parseInt($("#max-heart-rate").val()) 


		console.log(store.settings)

		localStorage.setItem("store", JSON.stringify(store))



        $("#reserveModal").modal('hide') ; 


		redraw()
        importData(store.settings.range_start_day, store.settings.range_end_day, [store.settings.active_day])


    }) ; 








    initialSetup()



    //d3.select("#svg-content").on("keydown", logKeyDown)
    //document.addEventListener('keydown', logKeyDown);
    //document.addEventListener('keyup', logKeyUp);
    $(window).on('keydown', handleKeyDown)



    d3.json('/api/fitbit_require_auth', {
        method: "GET",
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    }).then( (data) => {
		console.log("auth stuff")
		console.log(data)
		
		if (data.auth_url !== ""){
			alert("Not authorized, going to redirect to fitbit")
			console.log(data.auth_url)

			window.location.replace(data.auth_url);
		}
		else{

			if (!initialized){
				console.log("Initalizing.....")
				$("#settingsButton").trigger("click")
			}
			else{
				console.log("We alredy were initailized")
				loadAllData()
			}

		}


    }).catch( (error) => {
        console.log(error) ;
    })


/*
 *
 *

*/








});

