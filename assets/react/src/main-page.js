class MainPage extends React.Component {
    initializeRoute() {
        var viewBlogs = function (blogId) {
            this.setState({
                onMainContainer: false
            });
            console.log("blog id: " + blogId);
        }.bind(this);

        var routes = {
            '/blogs/:blogId': viewBlogs
        };

        var router = Router(routes);

        router.init();
    }

    constructor() {
        super();
        this.initializeRoute();
        this.state = {
            onMainContainer: true
        };
    }

    render() {
        return (
            <div>
                <Header isOnHomePage={this.state.onMainContainer}/>
                {this.state.onMainContainer ? <MainContainer /> : <BlogContainer />}
                <Footer />
            </div>
        );
    }
}

React.render(<MainPage />, document.getElementById('main-page'));