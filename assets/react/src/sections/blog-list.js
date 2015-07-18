class BlogArticle extends React.Component {
    render() {
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
        var linkUrl = baseUrl + "/blogs#" +  this.props.item.Url;
        return (
            <article className="item">
                <a href={linkUrl} className="image fit"><img src="images/pic03.jpg" alt=""/></a>
                <header>
                    <h3>{this.props.item.Title}</h3>
                </header>
            </article>
        );
    }
}

class BlogList extends React.Component {
    render() {
        var ArticlesComponent = this.props.list.map(item => {
            return <BlogArticle item={item}/>;
        });
        return (
            <div className="4u 12u$(mobile)">
                {ArticlesComponent}
            </div>
        );
    }
}

class BlogListSection extends React.Component {
    constructor() {
        super();
        this.state = {
            blogListCol1: [],
            blogListCol2: [],
            blogListCol3: []
        };
        $.get("http://haimingblogservice.azurewebsites.net/api/Posts", (data) => {
            var blogs = data.value;
            var index = 0;
            blogs.forEach(blog => {
                _.extend(blog, {index: index});
                index++;
            });
            this.setState({
                blogListCol1: _.filter(blogs, blog => {return blog.index % 3 == 0; }),
                blogListCol2: _.filter(blogs, blog => {return blog.index % 3 == 1; }),
                blogListCol3: _.filter(blogs, blog => {return blog.index % 3 == 2; })
            });
        });
    }

    render() {
        return (
            <section id="blogs" className="two">
                <div className="container">

                    <header>
                        <h2>Blogs</h2>
                    </header>

                    <p>Vitae natoque dictum etiam semper magnis enim feugiat convallis convallis
                        egestas rhoncus ridiculus in quis risus amet curabitur tempor orci penatibus.
                        Tellus erat mauris ipsum fermentum etiam vivamus eget. Nunc nibh morbi quis
                        fusce hendrerit lacus ridiculus.</p>

                    <div className="row">
                        <BlogList list={this.state.blogListCol1}/>
                        <BlogList list={this.state.blogListCol2}/>
                        <BlogList list={this.state.blogListCol3}/>
                    </div>

                </div>
            </section>
        );
    }
}