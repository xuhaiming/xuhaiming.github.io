define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
        var MainPage = React.createClass({displayName: "MainPage",
            componentDidMount: function() {

            },
            render: function(){
                return (
                React.createElement("div", {id: "wrapper"}


                )
                )
            }
        });

        React.render(
        React.createElement(MainPage, null),
            document.getElementById('main-page')
        );
    }
);