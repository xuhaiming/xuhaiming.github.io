var ____Classc=React.Component;for(var ____Classc____Key in ____Classc){if(____Classc.hasOwnProperty(____Classc____Key)){MainPage[____Classc____Key]=____Classc[____Classc____Key];}}var ____SuperProtoOf____Classc=____Classc===null?null:____Classc.prototype;MainPage.prototype=Object.create(____SuperProtoOf____Classc);MainPage.prototype.constructor=MainPage;MainPage.__superConstructor__=____Classc;function MainPage(){"use strict";if(____Classc!==null){____Classc.apply(this,arguments);}}
    Object.defineProperty(MainPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement(Header, null), 
                React.createElement(MainContainer, null), 
                React.createElement(Footer, null)
            )
        );
    }});


React.render(React.createElement(MainPage, null), document.getElementById('main-page'));