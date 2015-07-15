var ____Classf=React.Component;for(var ____Classf____Key in ____Classf){if(____Classf.hasOwnProperty(____Classf____Key)){MainPage[____Classf____Key]=____Classf[____Classf____Key];}}var ____SuperProtoOf____Classf=____Classf===null?null:____Classf.prototype;MainPage.prototype=Object.create(____SuperProtoOf____Classf);MainPage.prototype.constructor=MainPage;MainPage.__superConstructor__=____Classf;
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
        ____Classf.call(this);

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