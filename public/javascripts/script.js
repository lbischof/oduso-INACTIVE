$(function() {
    $(".logo").fitText(0.7, {maxFontSize: '100px'});
    var ms = $('#ms').magicSuggest({
        data: 'api/apps',
        valueField: '_id',
        displayField: 'name',
        allowFreeEntries: false,
        selectionPosition: 'bottom',
        typeDelay: 0,
        inputCfg: {"data-storage":"false"},
        highlight: false,
        maxSelection: null,
        useTabKey: true,
        placeholder: 'Search for apps',
        renderer: function(data){
            var img = '';
            var desc = '<span>'+data.desc+'</span>';
            if (data.imageType)
                img = '<img height="22" style="margin-right: 5px" src="/image/' + data._id + '">';
            return img + data.name + desc;
        },
        selectionRenderer: function(data){
            var img = '';
            var name = '<span>'+data.name+'</sapn>';
            if (data.imageType)
                img = '<img height="22" style="margin-right: 5px" src="/image/' + data._id + '">';
            return '<span class="item" data-toggle="tooltip" title="'+data.desc+'">'+img + name+'</span>';
        }
    });
    var savedItems = localStorage.getItem('ms');
    if (savedItems) {
        ms.setSelection(JSON.parse(localStorage.getItem('ms')));
    }
   $('#mainForm').submit(function(e){
        $(this).find (':submit').attr ('disabled', 'disabled');
    	$.ajax({
    		type: "POST",
    		url: $(this).attr('action'),
    		data: $(this).serialize(),
    		success: function(data){
                var data = JSON.parse(data);
    			$('#generatedCommand').text(data.command);
    			if (navigator.appVersion.indexOf("Linux") === -1) 
    				$('#generatedIcons').before("<p>It looks like you aren't using Linux. You can email the script to yourself or save to Dropbox.</p>");
                $('#generatedIcons .source').attr("href", data.link);
                $('#generatedIcons .email').attr("href", "mailto:?subject=Oduso Installer&body=Paste this command into your Terminal to run the Installer:%0D%0A"+data.command);
                $('#generatedIcons .save').attr("href", data.link+"/download");
                $('#generated').css({visibility: "visible"}).fadeTo(400, 1);
                SelectText('generatedCommand');
    		},
            error: function(xhr){
                alert("Nothing selected. Please select some apps or themes so I can generate an installer script.");
                //$('#generated').css({visibility: "visible"}).fadeTo(400, 1);
            }
    	});
    	e.preventDefault();
    });
    $('#generatedCommand').on( "mousedown", function(){
        SelectText('generatedCommand');
        return false;
    });
    function SelectText(element) {
    var doc = document
        , text = doc.getElementById(element)
        , range, selection
    ;
    if (doc.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}
    $(ms).on('selectionchange', function(e,m){
        $('#mainForm').find (':submit').removeAttr ('disabled');
        localStorage.setItem('ms',JSON.stringify(this.getSelection()));
        console.log(JSON.stringify(this.getSelection()));
        $('#generated').fadeTo(400, 0, function(){
            $(this).css({visibility: "hidden"});
        });
    });
    $('#mainForm').change(function (e) {
        $(this).find (':submit').removeAttr ('disabled');
        $('#generated').fadeTo(400, 0, function(){
            $(this).css({visibility: "hidden"});
        });
    });
    $('[data-toggle="popover"]').popover({'placement': 'top', trigger: 'focus', html: true});
$('body').tooltip({
    selector: '[data-toggle="tooltip"]',
    delay: {show: 500, hide: 0}
});

});
