var ____Classa=React.Component;for(var ____Classa____Key in ____Classa){if(____Classa.hasOwnProperty(____Classa____Key)){BlogArticle[____Classa____Key]=____Classa[____Classa____Key];}}var ____SuperProtoOf____Classa=____Classa===null?null:____Classa.prototype;BlogArticle.prototype=Object.create(____SuperProtoOf____Classa);BlogArticle.prototype.constructor=BlogArticle;BlogArticle.__superConstructor__=____Classa;function BlogArticle(){"use strict";if(____Classa!==null){____Classa.apply(this,arguments);}}
    Object.defineProperty(BlogArticle.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
        var linkUrl = baseUrl + "/blogs#" +  this.props.item.Url;
        return (
            React.createElement("article", {className: "item"}, 
                React.createElement("a", {href: linkUrl, className: "image fit"}, React.createElement("img", {src: "images/thumbnails/" + this.props.item.Url + ".png", alt: ""})), 
                React.createElement("header", null, 
                    React.createElement("h3", null, this.props.item.Title)
                )
            )
        );
    }});


var ____Classb=React.Component;for(var ____Classb____Key in ____Classb){if(____Classb.hasOwnProperty(____Classb____Key)){BlogList[____Classb____Key]=____Classb[____Classb____Key];}}var ____SuperProtoOf____Classb=____Classb===null?null:____Classb.prototype;BlogList.prototype=Object.create(____SuperProtoOf____Classb);BlogList.prototype.constructor=BlogList;BlogList.__superConstructor__=____Classb;function BlogList(){"use strict";if(____Classb!==null){____Classb.apply(this,arguments);}}
    Object.defineProperty(BlogList.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var ArticlesComponent = this.props.list.map(function(item)  {
            return React.createElement(BlogArticle, {item: item});
        });
        return (
            React.createElement("div", {className: "4u 12u$(mobile)"}, 
                ArticlesComponent
            )
        );
    }});


var ____Classc=React.Component;for(var ____Classc____Key in ____Classc){if(____Classc.hasOwnProperty(____Classc____Key)){BlogListSection[____Classc____Key]=____Classc[____Classc____Key];}}var ____SuperProtoOf____Classc=____Classc===null?null:____Classc.prototype;BlogListSection.prototype=Object.create(____SuperProtoOf____Classc);BlogListSection.prototype.constructor=BlogListSection;BlogListSection.__superConstructor__=____Classc;
    function BlogListSection() {"use strict";
        ____Classc.call(this);
        this.state = {
            blogListCol1: [],
            blogListCol2: [],
            blogListCol3: []
        };
        $.get("http://haimingblogservice.azurewebsites.net/api/Posts", function(data)  {
            var blogs = data.value;
            var index = 0;
            blogs.forEach(function(blog)  {
                _.extend(blog, {index: index});
                index++;
            });
            this.setState({
                blogListCol1: _.filter(blogs, function(blog)  {return blog.index % 3 == 0; }),
                blogListCol2: _.filter(blogs, function(blog)  {return blog.index % 3 == 1; }),
                blogListCol3: _.filter(blogs, function(blog)  {return blog.index % 3 == 2; })
            });
        }.bind(this));
    }

    Object.defineProperty(BlogListSection.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("section", {id: "blogs", className: "two"}, 
                React.createElement("div", {className: "container"}, 

                    React.createElement("header", null, 
                        React.createElement("h2", null, "Blogs")
                    ), 

                    React.createElement("p", null, "Vitae natoque dictum etiam semper magnis enim feugiat convallis convallis" + ' ' +
                        "egestas rhoncus ridiculus in quis risus amet curabitur tempor orci penatibus." + ' ' +
                        "Tellus erat mauris ipsum fermentum etiam vivamus eget. Nunc nibh morbi quis" + ' ' +
                        "fusce hendrerit lacus ridiculus."), 

                    React.createElement("div", {className: "row"}, 
                        React.createElement(BlogList, {list: this.state.blogListCol1}), 
                        React.createElement(BlogList, {list: this.state.blogListCol2}), 
                        React.createElement(BlogList, {list: this.state.blogListCol3})
                    )

                )
            )
        );
    }});
