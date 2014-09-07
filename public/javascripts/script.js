$(function() {
    $(".logo").fitText(0.7, {maxFontSize: '100px'});
    $('.distroselect').selectpicker();
    $('#dsForm').garlic({
      onRetrieve: function ( elem, retrievedValue ) {
          $('.distroselect').selectpicker('refresh');
      }
    });
    $('#form').on('submit','#mainForm',function(e){
        $(this).find (':submit').attr ('disabled', 'disabled');
        $.ajax({
          type: "POST",
          url: $(this).attr('action'),
          data: $(this).serialize(),
          success: function(data){
            var data = JSON.parse(data);
            $('#generatedCommand').text(data.command);
            if (navigator.appVersion.indexOf("Android") > -1 || navigator.appVersion.indexOf("Linux") === -1) 
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
    var doc = document,
    text = doc.getElementById(element),
    range, selection;
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
function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}
function ReloadPlugins(){
$('#mainForm').garlic();

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
var distro = getCookie("distro");
if (distro === undefined) {
    distro = "freya";
    $('.distroselect').garlic( 'destroy' );
    $('.distroselect').val("freya");
}
$(ms).on('selectionchange', function(e,m){
    $('#mainForm').find (':submit').removeAttr ('disabled');
    localStorage.setItem('ms'+distro,JSON.stringify(this.getSelection()));
    console.log(JSON.stringify(this.getSelection()));
    $('#generated').fadeTo(400, 0, function(){
        $(this).css({visibility: "hidden"});
    });
});
var savedItems = localStorage.getItem('ms'+distro);
    if (savedItems) {
        ms.setSelection(JSON.parse(savedItems));
    }
}

$('.distroselect').change(function() {
    var distro = $(this).val();
    $("#form").load("/form", {distro: distro}, ReloadPlugins);
});
$("#form").load("/form", {}, ReloadPlugins);

$('#form').on('change', '#mainForm',function (e) {
    $(this).find (':submit').removeAttr ('disabled');
    $('#generated').fadeTo(400, 0, function(){
        $(this).css({visibility: "hidden"});
    });
});
$('body').popover({
    placement: 'top',
    trigger: 'focus', 
    html: true,
    selector: '[data-toggle="popover"]'
});
$('body').tooltip({
    selector: '[data-toggle="tooltip"]',
    delay: {show: 500, hide: 0}
});

});
