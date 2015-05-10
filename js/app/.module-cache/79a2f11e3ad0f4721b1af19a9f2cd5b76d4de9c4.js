define(['react', 'jquery', 'skel', 'skelLayers','director', 'init', 'sideBar', 'content'], function(React, $, myskel, skelLayers, director, init, SideBar, Content) {
        var MainPage = React.createClass({displayName: "MainPage",
            componentWillMount: function(){

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