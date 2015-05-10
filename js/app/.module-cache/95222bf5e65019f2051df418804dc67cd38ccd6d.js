define(['react', 'jquery', 'skel', 'skelLayers', 'init', 'sideBar'], function(React, $, myskel, skelLayers, init, SideBar) {
        var MainPage = React.createClass({displayName: "MainPage",
            componentDidMount: function() {

            },
            render: function(){
                return (
                React.createElement("div", {id: "wrapper"}, 



                    React.createElement(SideBar, null)

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