const $ = require('jquery')
const { DateTime } = require('luxon')
const d3 = require('d3')
const bootstrap = require('bootstrap')
const datetimepicker = require('jquery-datetimepicker')



window.$ = $
//window.bootstrap = bootstrap
//window.aaa = DateTime


let ranges_used  = [];
let ranges_editing  = [];



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
	store.settings.range_interval = [0.05, 0.5, 0.95] ;
	store.settings.range_relevant_weekdays = "0,1,2,3,4,5,6";

	store.gui.max_heart_rate = 120
	store.gui.min_heart_rate = 40

	localStorage.setItem("store", JSON.stringify(store))
}
else{
	store.settings = JSON.parse(localStorage.getItem("store")).settings
	store.gui = JSON.parse(localStorage.getItem("store")).gui
	store.gui.max_heart_rate = 120
	store.gui.max_heart_rate = 85
	store.gui.min_heart_rate = 45
	initialized=true
}

window.mystore = store.settings
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

	store.y.domain([store.gui.min_heart_rate, store.gui.max_heart_rate])

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

    svg_properties.layer_median = g.append("g").attr("id", "median_layer")

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
        .domain([store.gui.min_heart_rate, store.gui.max_heart_rate])
        .range([svg_properties.height, 0]);

    svg_properties.yAxis = d3.axisLeft(store.y)
    svg_properties.layer_y_axis = g.append("g")
        .attr("class", "yaxis")
        .call(svg_properties.yAxis);



/*
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
	*/
}




function showData(range_id, range_data){

	console.log("Showdata for " + range_id )
	console.log(range_data)
	


	let _layer = svg_properties.layer_median
		.selectAll("#" + range_id) 
		.data([range_id])
		.enter()
		.append("g")
		.attr("id", range_id)

    let median_points = _layer
        .selectAll(".median")
        .data([range_data])

    median_points.enter()
        .append("path")
        .attr("fill", "none")
        .attr("class", "median")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.50)
        .attr("d", d3.line()
            .x(function (d) {return store.x(d.hours_since_midnight)})
            .y(function (d) {return store.y(0)})
        )
        .merge(median_points)
        .transition()
        .duration(750)
        .attr("d", d3.line()
            .x(function (d) {return store.x(d.hours_since_midnight)})
            .y(function (d) {return store.y(d.median)})
        )

    median_points.exit().remove()



}





function loadAllData(){
	const searchParams = new URLSearchParams()
	Object.entries(store.settings).forEach(([key, value]) => searchParams.append(key, value));

		for (let i=0 ; i<9 ; i++){
			console.log("afafa")

			settings_month = {}

			settings_month.id = "month-" + i;
			settings_month.smoothing_method = "gaussian" ;
			settings_month.gaussian_bucket_size = "60" ; 
			settings_month.gaussian_stddev = "4" ; 
			settings_month.range_start_day = "20200"+i+"01" ; 
			settings_month.range_end_day = "202000"+i+"31" ;
			settings_month.range_interval = "0.6" ;
			settings_month.range_relevant_weekdays = "0,1"



			const searchParams = new URLSearchParams()
			Object.entries(settings_month).forEach(([key, value]) => searchParams.append(key, value));

			let api_query_url_quantiles = "/api/quantiles/" + settings_month.range_start_day + "/" + settings_month.range_end_day + "?" + searchParams.toString()
			console.log(api_query_url_quantiles)

			d3.json(api_query_url_quantiles).then(dataset => {showData("month-" + i + "-weekend" , dataset)  })
		}


		for (let i=0 ; i<9 ; i++){
			console.log("afafa")

			settings_month = {}

			settings_month.id = "month-" + i;
			settings_month.smoothing_method = "gaussian" ;
			settings_month.gaussian_bucket_size = "60" ; 
			settings_month.gaussian_stddev = "4" ; 
			settings_month.range_start_day = "20200"+i+"01" ; 
			settings_month.range_end_day = "202000"+i+"31" ;
			settings_month.range_interval = "0.6" ;
			settings_month.range_relevant_weekdays = "2,3,4,5,6"



			const searchParams = new URLSearchParams()
			Object.entries(settings_month).forEach(([key, value]) => searchParams.append(key, value));

			let api_query_url_quantiles = "/api/quantiles/" + settings_month.range_start_day + "/" + settings_month.range_end_day + "?" + searchParams.toString()
			console.log(api_query_url_quantiles)

			d3.json(api_query_url_quantiles).then(dataset => {showData("month-" + i + "-weekday" , dataset)  })
		}




	for (let j=0 ; j<7 ; j++){
		for (let i=0 ; i<9 ; i++){
			console.log("afafa")

			settings_month = {}

			settings_month.id = "month-" + i;
			settings_month.smoothing_method = "gaussian" ;
			settings_month.gaussian_bucket_size = "60" ; 
			settings_month.gaussian_stddev = "4" ; 
			settings_month.range_start_day = "20200"+i+"01" ; 
			settings_month.range_end_day = "202000"+i+"31" ;
			settings_month.range_interval = [0.05, 0.5, 0.95] ;
			settings_month.range_relevant_weekdays = "" + j ;



			const searchParams = new URLSearchParams()
			Object.entries(settings_month).forEach(([key, value]) => searchParams.append(key, value));

			let api_query_url_quantiles = "/api/quantiles/" + settings_month.range_start_day + "/" + settings_month.range_end_day + "?" + searchParams.toString()
			console.log(api_query_url_quantiles)

			d3.json(api_query_url_quantiles).then(dataset => {showData("month-" + i + "-" + j, dataset)  })
		}
	}
















/*
	for (let i=1 ; i<10 ; i++){
		console.log("afafa")

		settings_month = {}

		settings_month.id = "month-" + i;
		settings_month.smoothing_method = "gaussian" ;
		settings_month.gaussian_bucket_size = "60" ; 
		settings_month.gaussian_stddev = "2" ; 
		settings_month.range_start_day = "20200101" ; 
		settings_month.range_end_day = "20200"+i+"31"
		settings_month.range_interval = "0.6" ;
		settings_month.range_relevant_weekdays = "0,1,2,3,4,5,6";



		const searchParams = new URLSearchParams()
		Object.entries(settings_month).forEach(([key, value]) => searchParams.append(key, value));

		let api_query_url_quantiles = "/api/quantiles/" + settings_month.range_start_day + "/" + settings_month.range_end_day + "?" + searchParams.toString()
		console.log(api_query_url_quantiles)

		d3.json(api_query_url_quantiles).then(dataset => {showData("month-" + i, dataset)  })
	}
	*/

}





$(document).ready(function() {
    $(window).resize(function() {
//		redraw()

//		showRangeData() ; 
//		showDailyData() ; 
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

	$("#list-group-ranges").on("click", "a", function(){
		$("#list-group-ranges .list-group-item").removeClass("active") ; 
		$(this).addClass("active") ; 

	})


    $("#settingsButton").click(function(){
        $("#range-list-modal").modal() ; 
	})

	$(".dropdown-menu[aria-labelledby=dropdownSmoothing] a").click(function () {
		// Get text from anchor tag
		var _method = $(this).text();
		$('#dropdownSmoothing').text(_method)

		$(".method-options").hide()
		$(".method-options-" + $(this).attr("data-value")   ).show()

		$("#smoothing-method").val($(this).attr("data-value"));
	});




	$("#range-list-new").click(function(){
        "0,1,2,3,4,5,6".split(",").forEach(function(e){
            $('[name=inlineWeekdayOptions][value='+e+']' ).prop("checked", true)
        })

        $("#range-name").val("")
        $("#range-edit-mode").val("new")

        $("#range_start").val("2020-01-01")
        $("#range_end").val( "2020-10-01")
        $("#gaussian-bucket-size").val("60")
        $("#gaussian-stddev").val("2")

        $("#moving-average-bucket-size").val("60")
        $("#moving-average-window").val("10")



		$("#dropdownSmoothingOptions a").filter("[data-value=gaussian]").trigger("click");

		$("#range-edit-modal").modal() ; 
	})


	$("#range-list-edit").click(function(){
		// Set the values from the selected item
		// Open up the edit screen

        "0,1,2,3,4,5,6".split(",").forEach(function(e){
            $('[name=inlineWeekdayOptions][value='+e+']' ).prop("checked", true)
        })

        $("#range-name").val("")
        $("#range-edit-mode").val("edit")

        $("#range_start").val("2020-01-01")
        $("#range_end").val( "2020-10-01")
        $("#gaussian-bucket-size").val("60")
        $("#gaussian-stddev").val("2")

        $("#moving-average-bucket-size").val("60")
        $("#moving-average-window").val("10")



		$("#dropdownSmoothingOptions a").filter("[data-value=gaussian]").trigger("click");

		$("#range-edit-modal").modal() ; 
	})

	$("#range-list-delete").click(function(){
		// Remove the selected item
		$("#list-group-ranges a.active").remove()
	})




    $("#settingsSubmit").click(function(e){
        // 
        e.preventDefault()
        var checked=[]
        $('[name=inlineWeekdayOptions]:checked').each(function(){
            checked.push($(this).val());
        });

		
		if ($("#range-edit-mode").val() === "edit"){
			_original = $("#list-group-ranges a.active")
			_copy = _original.clone()

			_copy.text($("#range-name").val())

			_copy.insertBefore(_original)
			_original.remove()
		}
		else{
			$("#list-group-ranges .list-group-item").removeClass("active") ; 

			var new_element = $("<a />")

			new_element.attr("href","#")
			new_element.addClass("list-group-item")
			new_element.addClass("list-group-item-action")
			new_element.addClass("active") ; 
			new_element.attr("data-range-id","aaaa")
			new_element.text($("#range-name").val())


			$("#list-group-ranges").append(new_element)





		}




        $("#range-edit-modal").modal('hide') ; 


    }) ; 








    initialSetup()



    //d3.select("#svg-content").on("keydown", logKeyDown)
    //document.addEventListener('keydown', logKeyDown);
    //document.addEventListener('keyup', logKeyUp);



	if (!initialized){
		console.log("Initalizing.....")
		$("#settingsButton").trigger("click")
	}
	else{
		console.log("We alredy were initailized")
		loadAllData()
	}


});

