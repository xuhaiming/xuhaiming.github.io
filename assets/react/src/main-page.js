class MainPage extends React.Component {
    render() {
        return (
            <div>
                <Header />
                <MainContainer />
                <Footer />
            </div>
        );
    }
}

React.render(<MainPage />, document.getElementById('main-page'));