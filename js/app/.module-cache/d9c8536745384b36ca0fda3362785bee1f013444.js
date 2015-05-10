define(['react', 'jquery', 'skel', 'skelLayers', 'init', 'sideBar', 'content'], function(React, $, myskel, skelLayers, init, SideBar, Content) {
        var MainPage = React.createClass({displayName: "MainPage",
            componentDidMount: function() {

            },
            render: function(){
                return (
                React.createElement("div", {id: "wrapper"}, 
                    React.createElement(Content, null), 
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