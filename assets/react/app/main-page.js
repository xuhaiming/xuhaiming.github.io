var ____Classe=React.Component;for(var ____Classe____Key in ____Classe){if(____Classe.hasOwnProperty(____Classe____Key)){MainPage[____Classe____Key]=____Classe[____Classe____Key];}}var ____SuperProtoOf____Classe=____Classe===null?null:____Classe.prototype;MainPage.prototype=Object.create(____SuperProtoOf____Classe);MainPage.prototype.constructor=MainPage;MainPage.__superConstructor__=____Classe;
    Object.defineProperty(MainPage.prototype,"initializeRoute",{writable:true,configurable:true,value:function() {"use strict";
        var viewBlogs = function (blogId) {
            this.setState({
                onMainContainer: false
            });
        }.bind(this);

        var routes = {
            'blog/:blogId': viewBlogs
        };

        var router = Router(routes);

        router.init();
    }});

    Object.defineProperty(MainPage.prototype,"componentDidMount",{writable:true,configurable:true,value:function() {"use strict";
        this.initializeRoute();
    }});

    function MainPage() {"use strict";
        ____Classe.call(this);

        this.state = {
            onMainContainer: true
        };
    }

    Object.defineProperty(MainPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement(Header, {isOnHomePage: this.state.onMainContainer}), 
                this.state.onMainContainer ? React.createElement(MainContainer, null) : React.createElement(BlogContainer, null), 
                React.createElement(Footer, null)
            )
        );
    }});


React.render(React.createElement(MainPage, null), document.getElementById('main-page'));