const nlcaApp = angular.module('nightlife-coordination-app', ['ui.router']);

let currentPos;

$(() => {
  const performSearch = function() {
    const searchQuery = $('#search-box')[0].value;
    document.location.hash = '/search/' + encodeURIComponent(searchQuery);
    if (searchQuery.length < 1) {
      return false;
    }
    $.ajax({
      method: 'POST',
      url: '/search',
      data: {
        query: searchQuery
      }
    })
    .done(res => {
      displayResults(res);
    });
  };

  if (sessionStorage.getItem('lastURL') !== null) {
    const redirectTo = sessionStorage.getItem('lastURL');
    sessionStorage.removeItem('lastURL');
    window.location.href = redirectTo;
  }
  if (window.location.hash.split('/')[1] === 'search') {
    $('#search-box')[0].value = decodeURIComponent(window.location.hash.split('/')[2]);
    $('#search-button').removeAttr('disabled');
    performSearch();
  }

  $('[data-toggle="tooltip"]').tooltip();
  if ('geolocation' in navigator) {
    $('#gps-icon')[0].style.display = 'inline';
  }

  const gpsAnimEnd = e => {
    if (e.type === 'animationend') {
      $('#search-box').removeClass('gpsFetch');
    }
  }

  const enterSearchUIFeedback = e => {
    if (e.type === 'animationend') {
      $('#search-button').removeClass('enterKeyFB');
    }
  }

  document.getElementById('search-box').addEventListener('animationend', gpsAnimEnd, false);

  document.getElementById('search-box').addEventListener('animationend', enterSearchUIFeedback, false);

  $('#get-location').click(() => {
    $('#search-box').addClass('gpsFetch');
    navigator.geolocation.getCurrentPosition(position => {
      $('#get-location').fadeOut();
      currentPos = position.coords.latitude.toFixed(5) + ', ' + position.coords.longitude.toFixed(5);
      $('#search-box')[0].value = currentPos;

      // Fire the input trigger for the search box since it will not fire if data is programmatically inputted.  
      $('#search-box').trigger('input');
    });
  });

  // Enable or Disable the search button based on whether there is input in the search box
  $('#search-box')[0].oninput = () => {
    if ($('#search-box')[0].value.length > 0 && $('#search-button')[0].disabled) {
      $('#search-button')[0].disabled = false;
    }
    if ($('#search-box')[0].value.length == 0 && !$('#search-button')[0].disabled) {
      $('#search-button')[0].disabled = true;
    }
  };

  $('#search-box').keypress(event => {
    if (event.keyCode === 13) {
      $('#search-button').trigger('click');
      $('#search-button').addClass('enterKeyFB');
    }
  });

  $('#search-box').focusin(() => {
    $('#search-span').addClass('sb-focus');
  });

  $('#search-box').focusout(() => {
    $('#search-span').removeClass('sb-focus');
  });

  $('#search-button').click(() => {
    performSearch();
  });

  const displayResults = res => {
    // Remove any previous results before displaying new ones...
    $('#results-table tbody').empty();

    const resTable = $('#results-table');
    for (let i = 0; i < 20; i++) {
      const listingName = res.businesses[i].name;
      const listingRating = res.businesses[i].rating;
      const listingReviewCount = res.businesses[i].review_count;
      const listingImg = res.businesses[i].image_url;
      const listingDesc = res.businesses[i].snippet_text;
      const listingUrl = res.businesses[i].url;
      const listingId = res.businesses[i].id;

      const row = $('<tr></tr>');
      const cell = $('<td></td>');
      const lnDiv = $('<div></div>');

      lnDiv.addClass('listing-name');

      const lnA = $('<a></a>');
      lnA.attr('href', listingUrl);
      lnA.text(listingName);

      lnDiv.append(lnA);

      const hr = $('<hr>');

      const liDiv = $('<div></div>');
      liDiv.addClass('listing-image');
      const liImg = $('<img>');
      liImg.attr('src', listingImg);
      liDiv.append(liImg);

      const liRatingDiv = $('<div></div>');
      liRatingDiv.addClass('ratings-div');
      const liRatingI = $('<i></i>');
      const ratingClass = `stars_${Math.floor(listingRating)}`;
      if (listingRating % 1 === 0.5) {
        ratingClass += '_half';
      }
      liRatingI.addClass(`star-img ${ratingClass}`);
      liRatingDiv.append(liRatingI);
      
      liRatingCountDiv = $('<div></div>');
      liRatingCountDiv.addClass('rating-count');
      liRatingCountDiv.text(`(${listingReviewCount} review${listingDesc === 1 ? ')' : 's)'}`);

      const liListingDescDiv = $('<div></div>');
      liListingDescDiv.addClass('listing-desc');

      const liDescDiv = $('<div></div>');
      liDescDiv.addClass('desc-div');
      const liDescSpan = $('<span></span>');
      liDescSpan.text(`${listingDesc} `);
      const liReadMore = document.createElement('a');
      liReadMore.href = listingUrl;
      liReadMore.innerHTML = '(read more) ';
      liDescDiv.append(liDescSpan);
      liDescDiv.append(liReadMore);

      const patronsDiv = $('<div></div>');
      patronsDiv.addClass('patrons-div');

      const patronsButton = $('<button></button>');
      patronsButton.attr('data-listing-id', listingId);
      patronsButton.attr('data-button-type', 'patrons');
      patronsButton.text('0 going');
      patronsDiv.append(patronsButton);

      liListingDescDiv.append(liRatingDiv).append(liRatingCountDiv).append(liDescDiv);
      liListingDescDiv.append(patronsDiv);

      cell.append(lnDiv).append(hr).append(liDiv).append(liListingDescDiv);

      row.append(cell);

      resTable.append(row);
    }

    // Register event listeners for these newly-created buttons
    $('button[data-button-type=patrons]').click(e => {
      const listingId = e.currentTarget.dataset.listingId;
      $.ajax({
        url: 'imgoing',
        data: { listingId: listingId },
        method: 'POST',        
        dataType: 'json',
        complete: (jqxhr, status) => {
          if (jqxhr.status === 401) {
            sessionStorage.setItem('lastURL', window.location.href);
            sessionStorage.setItem('lastScrollY', window.scrollY);
            window.location.href = '/auth/twitter';
          }
        }
      }).done(res => {
        if (res.status === 'added') {
          $(`button[data-listing-id=${res.listingId}]`).addClass('going');
          fetchPatronCounts();
        }
        if (res.status === 'removed') {
          $(`button[data-listing-id=${res.listingId}]`).removeClass('going');
          fetchPatronCounts();
        }
      });      
    });

    if (sessionStorage.getItem('lastScrollY') !== null) {
      window.scrollTo(0, sessionStorage.getItem('lastScrollY'));
      sessionStorage.removeItem('lastScrollY');
    }
    fetchPatronCounts();    
  };

  const fetchPatronCounts = () => {
    // The listing IDs are in all the buttons. So let's get those...
    const listingIdObj = {};
    const btns = $('button[data-listing-id]');
    for (let i = 0; i < btns.length; i++) {
      listingIdObj[i] = btns[i].getAttribute('data-listing-id');
    }
    $.ajax({
      url: '/getPatronCounts',
      data: listingIdObj,
      method: 'POST'
    }).done(data => {
      const dataLen = data.length;
      for (let i = 0; i < dataLen; i++) {
        $(`button[data-listing-id=${data[i].listingId}]`).text(`${data[i].nPatrons} going`);
      }
    });
  }

  window.addEventListener('hashchange', () => {
    if (document.location.hash === '' && $('#results-table tr').length > 0) {
      $('#results-table tr').remove();
    }
  });
});