class BlogPage extends React.Component {
    constructor() {
        super();
        this.state = {
            blog: {}
        };
    }

    initializeRoute() {
        var viewBlog = function (blogId) {
            $.get("http://haimingblogservice.azurewebsites.net/api/Posts?$filter=Url eq '" + blogId + "'", (data) => {
                this.setState({
                    blog: data.value[0]
                });
            });
        }.bind(this);

        var routes = {
            '/:blogId': viewBlog
        };

        var router = Router(routes);

        router.init();
    }

    componentDidMount() {
        this.initializeRoute();
    }

    render() {
        return (
            <div>
                <Header isOnMainPage={false}/>
                <BlogContainer blog={this.state.blog}/>
                <Footer />
            </div>
        );
    }
}

React.render(<BlogPage />, document.getElementById('blog-page'));